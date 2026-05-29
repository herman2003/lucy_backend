import { Inject, Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';

import { DOCUMENTS_STORAGE, type DocumentsStorage } from '../storage/documents-storage.port';
import { buildDocumentStoragePath } from '../utils/document-file.util';
import {
  DOCUMENT_CHUNKS_REPOSITORY,
  type DocumentChunksRepository,
} from './document-chunks.repository.port';
import type {
  DocumentsRepository,
  DocumentStatus,
  PersistedDocument,
} from './documents.repository.port';

type FirestoreDocumentData = {
  title: string;
  fileName: string;
  mimeType: string;
  storagePath: string;
  byteSize: number;
  status: DocumentStatus;
  searchEnabled: boolean;
  errorCode?: string;
  chunkCount?: number;
  pageCount?: number;
  ingestionAttempts?: number;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class FirestoreDocumentsRepository implements DocumentsRepository {
  private readonly logger = new Logger(FirestoreDocumentsRepository.name);

  constructor(
    @Inject(DOCUMENTS_STORAGE)
    private readonly storage: DocumentsStorage,
    @Inject(DOCUMENT_CHUNKS_REPOSITORY)
    private readonly chunksRepository: DocumentChunksRepository,
  ) {}

  async create(
    uid: string,
    input: Omit<
      PersistedDocument,
      | 'id'
      | 'uid'
      | 'storagePath'
      | 'status'
      | 'searchEnabled'
      | 'errorCode'
      | 'createdAt'
      | 'updatedAt'
    >,
  ): Promise<PersistedDocument> {
    const ref = this.documentsCollection(uid).doc();
    const id = ref.id;
    const now = new Date().toISOString();
    const storagePath = buildDocumentStoragePath(uid, id, input.fileName);
    const data: FirestoreDocumentData = {
      title: input.title,
      fileName: input.fileName,
      mimeType: input.mimeType,
      storagePath,
      byteSize: input.byteSize,
      status: 'uploading',
      searchEnabled: false,
      createdAt: now,
      updatedAt: now,
    };
    await ref.set(data);
    return { id, uid, ...data };
  }

  async list(uid: string): Promise<PersistedDocument[]> {
    const snapshot = await this.documentsCollection(uid)
      .orderBy('createdAt', 'desc')
      .get();
    return snapshot.docs.map((doc) =>
      this.toPersisted(uid, doc.id, doc.data() as FirestoreDocumentData),
    );
  }

  async hasUploadInProgress(uid: string): Promise<boolean> {
    const snapshot = await this.documentsCollection(uid)
      .where('status', 'in', ['uploading', 'processing'])
      .limit(1)
      .get();
    return !snapshot.empty;
  }

  async updateStatus(uid: string, id: string, status: DocumentStatus): Promise<void> {
    await this.documentsCollection(uid).doc(id).set(
      { status, updatedAt: new Date().toISOString() },
      { merge: true },
    );
  }

  async getById(uid: string, id: string): Promise<PersistedDocument | null> {
    const snapshot = await this.documentsCollection(uid).doc(id).get();
    if (!snapshot.exists) {
      return null;
    }
    return this.toPersisted(uid, id, snapshot.data() as FirestoreDocumentData);
  }

  async delete(uid: string, id: string): Promise<void> {
    const doc = await this.getById(uid, id);
    if (!doc) {
      return;
    }

    try {
      await this.storage.deleteObject(doc.storagePath);
    } catch (error) {
      this.logger.warn(
        `delete storage best-effort failed uid=${uid} docId=${id} path=${doc.storagePath}`,
        error,
      );
    }

    try {
      await this.chunksRepository.deleteChunks(uid, id);
    } catch (error) {
      this.logger.warn(`delete chunks best-effort failed uid=${uid} docId=${id}`, error);
    }

    await this.documentsCollection(uid).doc(id).delete();
  }

  async setSearchEnabled(
    uid: string,
    id: string,
    searchEnabled: boolean,
  ): Promise<PersistedDocument | null> {
    const ref = this.documentsCollection(uid).doc(id);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      return null;
    }
    const updatedAt = new Date().toISOString();
    await ref.set({ searchEnabled, updatedAt }, { merge: true });
    const merged = {
      ...(snapshot.data() as FirestoreDocumentData),
      searchEnabled,
      updatedAt,
    };
    return this.toPersisted(uid, id, merged);
  }

  async countActiveSearchEnabledReady(uid: string): Promise<number> {
    const snapshot = await this.documentsCollection(uid)
      .where('status', '==', 'ready')
      .where('searchEnabled', '==', true)
      .get();
    return snapshot.size;
  }

  async isStorageObjectPresent(uid: string, id: string): Promise<boolean> {
    const doc = await this.getById(uid, id);
    if (!doc) {
      return false;
    }
    return this.storage.isObjectPresent(doc.storagePath, doc.byteSize);
  }

  async getDetectedMimeType(uid: string, id: string): Promise<string | null> {
    const doc = await this.getById(uid, id);
    if (!doc) {
      return null;
    }
    return this.storage.detectMimeType(doc.storagePath);
  }

  async setErrorCode(uid: string, id: string, errorCode: string | undefined): Promise<void> {
    await this.documentsCollection(uid).doc(id).set(
      {
        errorCode: errorCode ?? admin.firestore.FieldValue.delete(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
  }

  async listByStatus(status: DocumentStatus): Promise<PersistedDocument[]> {
    const snapshot = await admin
      .firestore()
      .collectionGroup('documents')
      .where('status', '==', status)
      .get();
    return snapshot.docs.map((doc) => {
      const uid = doc.ref.parent.parent?.id;
      if (!uid) {
        throw new Error('Invalid document path for collection group query');
      }
      return this.toPersisted(uid, doc.id, doc.data() as FirestoreDocumentData);
    });
  }

  async markIngestionSuccess(
    uid: string,
    id: string,
    input: { chunkCount: number; pageCount?: number },
  ): Promise<void> {
    await this.documentsCollection(uid).doc(id).set(
      {
        status: 'ready',
        chunkCount: input.chunkCount,
        ...(input.pageCount !== undefined ? { pageCount: input.pageCount } : {}),
        errorCode: admin.firestore.FieldValue.delete(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
  }

  async markIngestionFailed(uid: string, id: string, errorCode: string): Promise<void> {
    await this.documentsCollection(uid).doc(id).set(
      {
        status: 'failed',
        errorCode,
        searchEnabled: false,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
  }

  async incrementIngestionAttempts(uid: string, id: string): Promise<number> {
    const ref = this.documentsCollection(uid).doc(id);
    const next = await admin.firestore().runTransaction(async (tx) => {
      const snapshot = await tx.get(ref);
      if (!snapshot.exists) {
        return 0;
      }
      const data = snapshot.data() as FirestoreDocumentData;
      const attempts = (data.ingestionAttempts ?? 0) + 1;
      tx.set(
        ref,
        { ingestionAttempts: attempts, updatedAt: new Date().toISOString() },
        { merge: true },
      );
      return attempts;
    });
    return next;
  }

  private documentsCollection(uid: string) {
    return admin.firestore().collection('users').doc(uid).collection('documents');
  }

  private toPersisted(
    uid: string,
    id: string,
    data: FirestoreDocumentData,
  ): PersistedDocument {
    return {
      id,
      uid,
      title: data.title,
      fileName: data.fileName,
      mimeType: data.mimeType,
      storagePath: data.storagePath,
      byteSize: data.byteSize,
      status: data.status,
      searchEnabled: data.searchEnabled,
      ...(data.errorCode ? { errorCode: data.errorCode } : {}),
      ...(data.chunkCount !== undefined ? { chunkCount: data.chunkCount } : {}),
      ...(data.pageCount !== undefined ? { pageCount: data.pageCount } : {}),
      ...(data.ingestionAttempts !== undefined
        ? { ingestionAttempts: data.ingestionAttempts }
        : {}),
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }
}
