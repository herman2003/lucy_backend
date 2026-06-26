import { Inject, Injectable } from '@nestjs/common';

import { InMemoryDocumentsStorage } from '../storage/in-memory-documents.storage';
import { DOCUMENTS_STORAGE, type DocumentsStorage } from '../storage/documents-storage.port';
import { buildDocumentStoragePath } from '../utils/document-file.util';
import type { DocumentOutlineEntry } from '../domain/document-outline.types';
import {
  DOCUMENT_CHUNKS_REPOSITORY,
  type DocumentChunksRepository,
} from './document-chunks.repository.port';
import type {
  DocumentsRepository,
  PersistedDocument,
} from './documents.repository.port';

@Injectable()
export class InMemoryDocumentsRepository implements DocumentsRepository {
  private readonly docsByUid = new Map<string, PersistedDocument[]>();

  constructor(
    @Inject(DOCUMENTS_STORAGE)
    private readonly storage: DocumentsStorage,
    @Inject(DOCUMENT_CHUNKS_REPOSITORY)
    private readonly chunksRepository: DocumentChunksRepository,
  ) {}

  private memoryStorage(): InMemoryDocumentsStorage {
    return this.storage as InMemoryDocumentsStorage;
  }

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
    const now = new Date().toISOString();
    const id = this.newId();
    const doc: PersistedDocument = {
      id,
      uid,
      title: input.title,
      fileName: input.fileName,
      mimeType: input.mimeType,
      storagePath: buildDocumentStoragePath(uid, id, input.fileName),
      byteSize: input.byteSize,
      status: 'uploading',
      searchEnabled: false,
      createdAt: now,
      updatedAt: now,
    };

    const list = this.docsByUid.get(uid) ?? [];
    list.push(doc);
    this.docsByUid.set(uid, list);
    return { ...doc };
  }

  async list(uid: string): Promise<PersistedDocument[]> {
    const docs = this.docsByUid.get(uid) ?? [];
    return docs
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((d) => ({ ...d }));
  }

  async hasUploadInProgress(uid: string): Promise<boolean> {
    const docs = this.docsByUid.get(uid) ?? [];
    return docs.some((d) => d.status === 'uploading' || d.status === 'processing');
  }

  async updateStatus(uid: string, id: string, status: PersistedDocument['status']): Promise<void> {
    const doc = this.findDoc(uid, id);
    if (!doc) {
      return;
    }
    doc.status = status;
    doc.updatedAt = new Date().toISOString();
  }

  async getById(uid: string, id: string): Promise<PersistedDocument | null> {
    const doc = this.findDoc(uid, id);
    return doc ? { ...doc } : null;
  }

  async delete(uid: string, id: string): Promise<void> {
    const doc = this.findDoc(uid, id);
    if (doc) {
      await this.storage.deleteObject(doc.storagePath);
      await this.chunksRepository.deleteChunks(uid, id);
    }
    const docs = this.docsByUid.get(uid) ?? [];
    this.docsByUid.set(
      uid,
      docs.filter((d) => d.id !== id),
    );
  }

  async setSearchEnabled(
    uid: string,
    id: string,
    searchEnabled: boolean,
  ): Promise<PersistedDocument | null> {
    const doc = this.findDoc(uid, id);
    if (!doc) {
      return null;
    }
    doc.searchEnabled = searchEnabled;
    doc.updatedAt = new Date().toISOString();
    return { ...doc };
  }

  async countActiveSearchEnabledReady(uid: string): Promise<number> {
    const docs = this.docsByUid.get(uid) ?? [];
    return docs.filter((d) => d.status === 'ready' && d.searchEnabled).length;
  }

  async isStorageObjectPresent(uid: string, id: string): Promise<boolean> {
    const doc = this.findDoc(uid, id);
    if (!doc) {
      return false;
    }
    return this.storage.isObjectPresent(doc.storagePath, doc.byteSize);
  }

  async getDetectedMimeType(uid: string, id: string): Promise<string | null> {
    const doc = this.findDoc(uid, id);
    if (!doc) {
      return null;
    }
    return this.storage.detectMimeType(doc.storagePath);
  }

  async setErrorCode(uid: string, id: string, errorCode: string | undefined): Promise<void> {
    const doc = this.findDoc(uid, id);
    if (!doc) return;
    doc.errorCode = errorCode;
    doc.updatedAt = new Date().toISOString();
  }

  async listByStatus(status: PersistedDocument['status']): Promise<PersistedDocument[]> {
    const results: PersistedDocument[] = [];
    for (const docs of this.docsByUid.values()) {
      for (const doc of docs) {
        if (doc.status === status) {
          results.push({ ...doc });
        }
      }
    }
    return results;
  }

  async markIngestionSuccess(
    uid: string,
    id: string,
    input: { chunkCount: number; pageCount?: number; outline?: DocumentOutlineEntry[] },
  ): Promise<void> {
    const doc = this.findDoc(uid, id);
    if (!doc) {
      return;
    }
    doc.status = 'ready';
    doc.chunkCount = input.chunkCount;
    doc.pageCount = input.pageCount;
    if (input.outline !== undefined) {
      doc.outline = input.outline;
    } else {
      delete doc.outline;
    }
    doc.errorCode = undefined;
    doc.updatedAt = new Date().toISOString();
  }

  async markIngestionFailed(uid: string, id: string, errorCode: string): Promise<void> {
    const doc = this.findDoc(uid, id);
    if (!doc) {
      return;
    }
    doc.status = 'failed';
    doc.errorCode = errorCode;
    doc.searchEnabled = false;
    doc.updatedAt = new Date().toISOString();
  }

  async incrementIngestionAttempts(uid: string, id: string): Promise<number> {
    const doc = this.findDoc(uid, id);
    if (!doc) {
      return 0;
    }
    doc.ingestionAttempts = (doc.ingestionAttempts ?? 0) + 1;
    doc.updatedAt = new Date().toISOString();
    return doc.ingestionAttempts;
  }

  /** Test helper — backdates timestamps (upload sweeper tests). */
  __backdateTimestamps(uid: string, id: string, iso: string): void {
    const doc = this.findDoc(uid, id);
    if (!doc) {
      return;
    }
    doc.createdAt = iso;
    doc.updatedAt = iso;
  }

  /** Test helper — simulates Storage PUT for a document. */
  __setStorageObjectPresent(
    uid: string,
    id: string,
    present: boolean,
    detectedMime?: string,
  ): void {
    const doc = this.findDoc(uid, id);
    if (!doc || !present) {
      return;
    }
    this.memoryStorage().__setObject(doc.storagePath, doc.byteSize, detectedMime);
  }

  /** @deprecated use __setStorageObjectPresent */
  __setDetectedMimeType(uid: string, id: string, mimeType: string): void {
    this.__setStorageObjectPresent(uid, id, true, mimeType);
  }

  private findDoc(uid: string, id: string): PersistedDocument | undefined {
    const docs = this.docsByUid.get(uid) ?? [];
    return docs.find((d) => d.id === id);
  }

  private newId(): string {
    return `doc_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
  }
}
