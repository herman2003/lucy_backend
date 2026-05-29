import { Inject, Injectable, Logger } from '@nestjs/common';

import { LucyErrorCodes } from '../../../core/errors/lucy-error-codes';
import { LucyApiError } from '../../../core/errors/lucy-api.error';
import type { CreateDocumentRequestDto } from '../dto/create-document.dto';
import type { CreateDocumentResponseDto } from '../dto/create-document-response.dto';
import type { DocumentDetailDto } from '../dto/document-detail.dto';
import type { DocumentDownloadResponseDto } from '../dto/document-download-response.dto';
import type { DocumentListItemDto } from '../dto/document-list-item.dto';
import {
  DOCUMENT_CHUNKS_REPOSITORY,
  type DocumentChunksRepository,
} from '../repositories/document-chunks.repository.port';
import {
  DOCUMENTS_REPOSITORY,
  type DocumentsRepository,
} from '../repositories/documents.repository.port';
import {
  DOCUMENTS_STORAGE,
  type DocumentsStorage,
} from '../storage/documents-storage.port';
import { DocumentIngestionService } from './document-ingestion.service';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    @Inject(DOCUMENTS_REPOSITORY)
    private readonly documentsRepository: DocumentsRepository,
    @Inject(DOCUMENTS_STORAGE)
    private readonly documentsStorage: DocumentsStorage,
    @Inject(DOCUMENT_CHUNKS_REPOSITORY)
    private readonly chunksRepository: DocumentChunksRepository,
    private readonly ingestionService: DocumentIngestionService,
  ) {}

  async create(uid: string, input: CreateDocumentRequestDto): Promise<CreateDocumentResponseDto> {
    const hasInProgress = await this.documentsRepository.hasUploadInProgress(uid);
    if (hasInProgress) {
      this.logger.warn(`create blocked uid=${uid} reason=DOCUMENT_UPLOAD_IN_PROGRESS`);
      throw new LucyApiError(
        409,
        LucyErrorCodes.DOCUMENT_UPLOAD_IN_PROGRESS,
        'A document upload or processing is already in progress',
      );
    }

    const created = await this.documentsRepository.create(uid, input);
    const signed = await this.documentsStorage.getUploadSignedUrl(
      created.storagePath,
      created.mimeType,
    );

    this.logger.log(
      `create ok uid=${uid} docId=${created.id} status=uploading mime=${created.mimeType} byteSize=${created.byteSize} storagePath=${created.storagePath}`,
    );

    return {
      id: created.id,
      uploadUrl: signed.url,
      expiresAt: signed.expiresAt,
    };
  }

  /** Server-side upload (Flutter web proxy — avoids R2 bucket CORS in dev). */
  async uploadObject(uid: string, id: string, body: Buffer, mimeType: string): Promise<void> {
    this.logger.log(`uploadObject start uid=${uid} docId=${id} bytes=${body.length}`);
    const doc = await this.documentsRepository.getById(uid, id);
    if (!doc) {
      throw new LucyApiError(404, LucyErrorCodes.DOCUMENT_NOT_FOUND, 'Document not found');
    }
    if (doc.status !== 'uploading') {
      throw new LucyApiError(
        409,
        LucyErrorCodes.DOCUMENT_PROCESSING_IN_PROGRESS,
        'Document is not awaiting upload',
      );
    }
    if (body.length !== doc.byteSize) {
      throw new LucyApiError(
        400,
        LucyErrorCodes.VALIDATION_ERROR,
        'Uploaded byte size does not match declared byteSize',
      );
    }
    await this.documentsStorage.putObject(doc.storagePath, body, mimeType);
    this.logger.log(`uploadObject ok uid=${uid} docId=${id} path=${doc.storagePath}`);
  }

  async list(uid: string): Promise<DocumentListItemDto[]> {
    const docs = await this.documentsRepository.list(uid);
    return docs.map((d) => ({
      id: d.id,
      title: d.title,
      fileName: d.fileName,
      mimeType: d.mimeType,
      byteSize: d.byteSize,
      status: d.status,
      searchEnabled: d.searchEnabled,
      ...(d.errorCode ? { errorCode: d.errorCode } : {}),
      ...(d.chunkCount !== undefined ? { chunkCount: d.chunkCount } : {}),
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    }));
  }

  async getById(uid: string, id: string): Promise<DocumentDetailDto> {
    const doc = await this.documentsRepository.getById(uid, id);
    if (!doc) {
      throw new LucyApiError(404, LucyErrorCodes.DOCUMENT_NOT_FOUND, 'Document not found');
    }
    return {
      id: doc.id,
      title: doc.title,
      fileName: doc.fileName,
      mimeType: doc.mimeType,
      byteSize: doc.byteSize,
      status: doc.status,
      searchEnabled: doc.searchEnabled,
      ...(doc.errorCode ? { errorCode: doc.errorCode } : {}),
      ...(doc.chunkCount !== undefined ? { chunkCount: doc.chunkCount } : {}),
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  async getDownloadUrl(uid: string, id: string): Promise<DocumentDownloadResponseDto> {
    const doc = await this.documentsRepository.getById(uid, id);
    if (!doc) {
      throw new LucyApiError(404, LucyErrorCodes.DOCUMENT_NOT_FOUND, 'Document not found');
    }
    const signed = await this.documentsStorage.getDownloadSignedUrl(doc.storagePath);
    return {
      downloadUrl: signed.url,
      expiresAt: signed.expiresAt,
    };
  }

  async complete(uid: string, id: string): Promise<{ id: string; status: string }> {
    this.logger.log(`complete start uid=${uid} docId=${id}`);
    const doc = await this.documentsRepository.getById(uid, id);
    if (!doc) {
      this.logger.warn(`complete not found uid=${uid} docId=${id}`);
      throw new LucyApiError(404, LucyErrorCodes.DOCUMENT_NOT_FOUND, 'Document not found');
    }

    if (doc.status === 'processing' || doc.status === 'ready') {
      this.logger.log(
        `complete noop uid=${uid} docId=${id} status=${doc.status} (already past uploading)`,
      );
      return { id: doc.id, status: doc.status };
    }

    this.logger.log(
      `complete check storage uid=${uid} docId=${id} expectedByteSize=${doc.byteSize} storagePath=${doc.storagePath}`,
    );
    const present = await this.documentsRepository.isStorageObjectPresent(uid, id);
    if (!present) {
      this.logger.warn(
        `complete storage not ready uid=${uid} docId=${id} error=${LucyErrorCodes.DOCUMENT_UPLOAD_NOT_READY}`,
      );
      throw new LucyApiError(
        409,
        LucyErrorCodes.DOCUMENT_UPLOAD_NOT_READY,
        'Upload not ready',
      );
    }

    const detected = await this.documentsRepository.getDetectedMimeType(uid, id);
    this.logger.log(
      `complete storage ok uid=${uid} docId=${id} declaredMime=${doc.mimeType} detectedMime=${detected ?? 'unknown'}`,
    );
    if (detected && detected !== doc.mimeType) {
      this.logger.warn(
        `complete mime mismatch uid=${uid} docId=${id} declared=${doc.mimeType} detected=${detected}`,
      );
      await this.documentsRepository.updateStatus(uid, id, 'failed');
      await this.documentsRepository.setSearchEnabled(uid, id, false);
      await this.documentsRepository.setErrorCode(uid, id, LucyErrorCodes.DOCUMENT_TYPE_MISMATCH);

      throw new LucyApiError(
        422,
        LucyErrorCodes.DOCUMENT_TYPE_MISMATCH,
        'Document type mismatch',
      );
    }

    await this.documentsRepository.updateStatus(uid, id, 'processing');
    this.ingestionService.enqueueIngestion(uid, id);
    this.logger.log(`complete ok uid=${uid} docId=${id} status=processing ingestion=enqueued`);
    return { id, status: 'processing' };
  }

  async delete(uid: string, id: string): Promise<void> {
    this.logger.log(`delete start uid=${uid} docId=${id}`);
    const doc = await this.documentsRepository.getById(uid, id);
    if (!doc) {
      this.logger.warn(`delete not found uid=${uid} docId=${id}`);
      throw new LucyApiError(404, LucyErrorCodes.DOCUMENT_NOT_FOUND, 'Document not found');
    }
    if (doc.status === 'processing') {
      this.logger.warn(
        `delete blocked uid=${uid} docId=${id} status=processing error=${LucyErrorCodes.DOCUMENT_PROCESSING_IN_PROGRESS}`,
      );
      throw new LucyApiError(
        409,
        LucyErrorCodes.DOCUMENT_PROCESSING_IN_PROGRESS,
        'Document processing in progress',
      );
    }
    try {
      await this.documentsRepository.delete(uid, id);
      this.logger.log(`delete ok uid=${uid} docId=${id} previousStatus=${doc.status}`);
    } catch (error) {
      this.logger.error(`delete failed uid=${uid} docId=${id}`, error);
      throw error;
    }
  }

  async setSearchEnabled(uid: string, id: string, enabled: boolean): Promise<DocumentDetailDto> {
    const doc = await this.documentsRepository.getById(uid, id);
    if (!doc) {
      throw new LucyApiError(404, LucyErrorCodes.DOCUMENT_NOT_FOUND, 'Document not found');
    }
    if (doc.status !== 'ready') {
      throw new LucyApiError(
        409,
        LucyErrorCodes.DOCUMENT_PROCESSING_IN_PROGRESS,
        'Document is not ready',
      );
    }

    if (enabled && !doc.searchEnabled) {
      const active = await this.documentsRepository.countActiveSearchEnabledReady(uid);
      if (active >= 5) {
        throw new LucyApiError(
          409,
          LucyErrorCodes.SEARCH_ACTIVE_LIMIT_EXCEEDED,
          'Search active limit exceeded',
        );
      }
    }

    const updated = await this.documentsRepository.setSearchEnabled(uid, id, enabled);
    if (!updated) {
      throw new LucyApiError(404, LucyErrorCodes.DOCUMENT_NOT_FOUND, 'Document not found');
    }
    return this.getById(uid, id);
  }

  async reprocess(uid: string, id: string): Promise<{ id: string; status: string }> {
    const doc = await this.documentsRepository.getById(uid, id);
    if (!doc) {
      throw new LucyApiError(404, LucyErrorCodes.DOCUMENT_NOT_FOUND, 'Document not found');
    }
    if (doc.status !== 'failed') {
      throw new LucyApiError(
        409,
        LucyErrorCodes.DOCUMENT_PROCESSING_IN_PROGRESS,
        'Only failed documents can be reprocessed',
      );
    }

    const present = await this.documentsRepository.isStorageObjectPresent(uid, id);
    if (!present) {
      throw new LucyApiError(
        422,
        LucyErrorCodes.UPLOAD_ABANDONED,
        'Original file is no longer available; upload again',
      );
    }

    await this.chunksRepository.deleteChunks(uid, id);
    await this.documentsRepository.setErrorCode(uid, id, undefined);
    await this.documentsRepository.updateStatus(uid, id, 'processing');
    this.ingestionService.enqueueIngestion(uid, id);
    this.logger.log(`reprocess ok uid=${uid} docId=${id} status=processing ingestion=enqueued`);
    return { id, status: 'processing' };
  }
}
