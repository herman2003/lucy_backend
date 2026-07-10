import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import {
  formatFirestoreIndexHint,
  isFirestoreMissingIndexError,
  isFirestoreTransientError,
} from '../../../core/firestore/firestore-index.util';
import { LucyErrorCodes } from '../../../core/errors/lucy-error-codes';
import {
  DOCUMENTS_REPOSITORY,
  type DocumentsRepository,
} from '../repositories/documents.repository.port';
import {
  DOCUMENTS_STORAGE,
  type DocumentsStorage,
} from '../storage/documents-storage.port';
import {
  UPLOAD_ABANDONED_AFTER_MS,
  UPLOAD_SWEEP_INTERVAL_MS,
} from '../utils/documents-upload.constants';

/** Marks stale `uploading` documents as failed and removes orphan Storage objects (SPEC C6). */
@Injectable()
export class DocumentUploadSweeperService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DocumentUploadSweeperService.name);
  private intervalHandle: ReturnType<typeof setInterval> | undefined;

  constructor(
    @Inject(DOCUMENTS_REPOSITORY)
    private readonly documentsRepository: DocumentsRepository,
    @Inject(DOCUMENTS_STORAGE)
    private readonly documentsStorage: DocumentsStorage,
  ) {}

  onModuleInit(): void {
    void this.sweepAbandonedUploads();
    this.intervalHandle = setInterval(() => {
      void this.sweepAbandonedUploads();
    }, UPLOAD_SWEEP_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.intervalHandle !== undefined) {
      clearInterval(this.intervalHandle);
    }
  }

  async sweepAbandonedUploads(): Promise<number> {
    const cutoff = Date.now() - UPLOAD_ABANDONED_AFTER_MS;
    let uploading;
    try {
      uploading = await this.documentsRepository.listByStatus('uploading');
    } catch (error) {
      if (isFirestoreMissingIndexError(error)) {
        this.logger.warn(
          `Upload sweeper skipped (missing Firestore index). Create COLLECTION_GROUP index on documents.status: ${formatFirestoreIndexHint(error)}`,
        );
        return 0;
      }
      if (isFirestoreTransientError(error)) {
        this.logger.warn(
          `Upload sweeper skipped (Firestore unreachable). Will retry on next interval.`,
        );
        return 0;
      }
      throw error;
    }
    let swept = 0;

    for (const doc of uploading) {
      const updatedAt = Date.parse(doc.updatedAt);
      if (Number.isNaN(updatedAt) || updatedAt > cutoff) {
        continue;
      }

      await this.documentsRepository.markIngestionFailed(
        doc.uid,
        doc.id,
        LucyErrorCodes.UPLOAD_ABANDONED,
      );
      await this.documentsStorage.deleteObject(doc.storagePath);
      swept += 1;
      this.logger.log(`Marked upload abandoned: ${doc.uid}/${doc.id}`);
    }

    return swept;
  }
}
