import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';

import {
  formatFirestoreIndexHint,
  isFirestoreMissingIndexError,
} from '../../../core/firestore/firestore-index.util';
import { EMBEDDING_PORT } from '../../../core/llm/embedding.tokens';
import type { EmbeddingPort } from '../../../core/llm/embedding.port';
import { LucyErrorCodes } from '../../../core/errors/lucy-error-codes';
import { LucyApiError } from '../../../core/errors/lucy-api.error';
import {
  DOCUMENT_CHUNKS_REPOSITORY,
  type DocumentChunksRepository,
  type PersistedDocumentChunk,
} from '../repositories/document-chunks.repository.port';
import {
  DOCUMENTS_REPOSITORY,
  type DocumentsRepository,
} from '../repositories/documents.repository.port';
import {
  DOCUMENTS_STORAGE,
  type DocumentsStorage,
} from '../storage/documents-storage.port';
import {
  INGESTION_EMBED_BATCH_SIZE,
  INGESTION_MAX_ATTEMPTS,
  INGESTION_MAX_EXTRACTED_CHARS,
  INGESTION_MAX_PDF_PAGES,
  INGESTION_MIN_DOCX_EXTRACTED_CHARS,
  INGESTION_RETRY_DELAYS_MS,
  INGESTION_STALE_PROCESSING_MS,
} from '../utils/documents-ingestion.constants';
import { DocumentChunkingService } from './document-chunking.service';
import { DocumentIngestionJobStore } from './document-ingestion-job.store';
import { DocumentTextExtractorService } from './document-text-extractor.service';

@Injectable()
export class DocumentIngestionService implements OnModuleInit {
  private readonly logger = new Logger(DocumentIngestionService.name);
  private readonly jobStore = new DocumentIngestionJobStore();
  private pumpRunning = false;

  constructor(
    @Inject(DOCUMENTS_REPOSITORY)
    private readonly documentsRepository: DocumentsRepository,
    @Inject(DOCUMENTS_STORAGE)
    private readonly documentsStorage: DocumentsStorage,
    @Inject(DOCUMENT_CHUNKS_REPOSITORY)
    private readonly chunksRepository: DocumentChunksRepository,
    private readonly textExtractor: DocumentTextExtractorService,
    private readonly chunkingService: DocumentChunkingService,
    @Inject(EMBEDDING_PORT)
    private readonly embeddingPort: EmbeddingPort,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      const processing = await this.documentsRepository.listByStatus('processing');
      const staleBefore = Date.now() - INGESTION_STALE_PROCESSING_MS;
      for (const doc of processing) {
        const updatedAt = Date.parse(doc.updatedAt);
        if (Number.isNaN(updatedAt) || updatedAt <= staleBefore) {
          this.scheduleJob(doc.uid, doc.id, 0);
        }
      }
    } catch (error) {
      if (isFirestoreMissingIndexError(error)) {
        this.logger.warn(
          `Skipping stale processing recovery (missing Firestore index). Create COLLECTION_GROUP index on documents.status: ${formatFirestoreIndexHint(error)}`,
        );
      } else {
        throw error;
      }
    }
    void this.pumpJobs();
  }

  enqueueIngestion(uid: string, documentId: string): void {
    this.logger.log(`enqueue uid=${uid} docId=${documentId}`);
    this.scheduleJob(uid, documentId, 0);
    void this.pumpJobs();
  }

  private scheduleJob(uid: string, documentId: string, delayMs: number): void {
    this.jobStore.schedule({
      uid,
      documentId,
      runAfterMs: Date.now() + delayMs,
    });
  }

  private async pumpJobs(): Promise<void> {
    if (this.pumpRunning) {
      return;
    }
    this.pumpRunning = true;
    try {
      while (this.jobStore.hasPending()) {
        const job = this.jobStore.pollReady();
        if (!job) {
          await sleep(50);
          continue;
        }
        await this.runIngestionJob(job.uid, job.documentId);
      }
    } finally {
      this.pumpRunning = false;
    }
  }

  private async runIngestionJob(uid: string, documentId: string): Promise<void> {
    const doc = await this.documentsRepository.getById(uid, documentId);
    if (!doc || doc.status !== 'processing') {
      this.logger.debug(
        `job skip uid=${uid} docId=${documentId} reason=${!doc ? 'not_found' : `status=${doc.status}`}`,
      );
      return;
    }

    this.logger.log(
      `job start uid=${uid} docId=${documentId} mime=${doc.mimeType} storagePath=${doc.storagePath}`,
    );

    try {
      await this.ingestDocument(uid, documentId, doc.mimeType, doc.storagePath);
      this.logger.log(`job success uid=${uid} docId=${documentId} status=ready`);
    } catch (error) {
      const code = this.resolveFailureCode(error);
      const isTransient = code === LucyErrorCodes.LLM_UNAVAILABLE;
      if (isTransient) {
        const attempts = await this.documentsRepository.incrementIngestionAttempts(
          uid,
          documentId,
        );
        if (attempts >= INGESTION_MAX_ATTEMPTS) {
          this.logger.warn(
            `job failed uid=${uid} docId=${documentId} error=${LucyErrorCodes.DOCUMENT_PROCESSING_FAILED} attempts=${attempts} transient=exhausted`,
          );
          await this.documentsRepository.markIngestionFailed(
            uid,
            documentId,
            LucyErrorCodes.DOCUMENT_PROCESSING_FAILED,
          );
          return;
        }
        const delay =
          INGESTION_RETRY_DELAYS_MS[attempts - 1] ??
          INGESTION_RETRY_DELAYS_MS[INGESTION_RETRY_DELAYS_MS.length - 1] ??
          1000;
        this.logger.warn(
          `job retry uid=${uid} docId=${documentId} error=${code} attempt=${attempts} delayMs=${delay}`,
        );
        this.scheduleJob(uid, documentId, delay);
        void this.pumpJobs();
        return;
      }

      this.logger.warn(`job failed uid=${uid} docId=${documentId} error=${code}`);
      await this.documentsRepository.markIngestionFailed(uid, documentId, code);
    }
  }

  private async ingestDocument(
    uid: string,
    documentId: string,
    mimeType: string,
    storagePath: string,
  ): Promise<void> {
    const fileBuffer = await this.documentsStorage.downloadObject(storagePath);
    this.logger.log(
      `extract start uid=${uid} docId=${documentId} mime=${mimeType} bytes=${fileBuffer.length}`,
    );
    const extracted = await this.textExtractor.extract(fileBuffer, mimeType);
    this.logger.log(
      `extract ok uid=${uid} docId=${documentId} chars=${extracted.text.length}${extracted.pageCount !== undefined ? ` pages=${extracted.pageCount}` : ''}`,
    );

    if (mimeType === 'application/pdf' && extracted.pageCount !== undefined) {
      if (extracted.pageCount > INGESTION_MAX_PDF_PAGES) {
        this.logger.warn(
          `ingest rejected uid=${uid} docId=${documentId} error=${LucyErrorCodes.DOCUMENT_TOO_LARGE} pages=${extracted.pageCount}`,
        );
        await this.documentsRepository.markIngestionFailed(
          uid,
          documentId,
          LucyErrorCodes.DOCUMENT_TOO_LARGE,
        );
        return;
      }
    }

    if (extracted.text.length > INGESTION_MAX_EXTRACTED_CHARS) {
      this.logger.warn(
        `ingest rejected uid=${uid} docId=${documentId} error=${LucyErrorCodes.DOCUMENT_TOO_LARGE} chars=${extracted.text.length}`,
      );
      await this.documentsRepository.markIngestionFailed(
        uid,
        documentId,
        LucyErrorCodes.DOCUMENT_TOO_LARGE,
      );
      return;
    }

    if (
      mimeType ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' &&
      extracted.text.length < INGESTION_MIN_DOCX_EXTRACTED_CHARS
    ) {
      this.logger.warn(
        `ingest rejected uid=${uid} docId=${documentId} error=${LucyErrorCodes.DOCUMENT_EMPTY_EXTRACTION} chars=${extracted.text.length}`,
      );
      await this.documentsRepository.markIngestionFailed(
        uid,
        documentId,
        LucyErrorCodes.DOCUMENT_EMPTY_EXTRACTION,
      );
      return;
    }

    if (!extracted.text.trim()) {
      this.logger.warn(
        `ingest rejected uid=${uid} docId=${documentId} error=${LucyErrorCodes.DOCUMENT_EMPTY_EXTRACTION}`,
      );
      await this.documentsRepository.markIngestionFailed(
        uid,
        documentId,
        LucyErrorCodes.DOCUMENT_EMPTY_EXTRACTION,
      );
      return;
    }

    const chunks = this.chunkingService.chunkText(extracted.text);
    if (chunks.length === 0) {
      this.logger.warn(
        `ingest rejected uid=${uid} docId=${documentId} error=${LucyErrorCodes.DOCUMENT_EMPTY_EXTRACTION} chunks=0`,
      );
      await this.documentsRepository.markIngestionFailed(
        uid,
        documentId,
        LucyErrorCodes.DOCUMENT_EMPTY_EXTRACTION,
      );
      return;
    }

    this.logger.log(`embed start uid=${uid} docId=${documentId} chunks=${chunks.length}`);
    const embeddings = await this.embedInBatches(chunks.map((chunk) => chunk.text));
    this.logger.log(`embed ok uid=${uid} docId=${documentId} vectors=${embeddings.length}`);
    const persisted: PersistedDocumentChunk[] = chunks.map((chunk, index) => ({
      id: `chunk_${chunk.ordinal}`,
      ordinal: chunk.ordinal,
      text: chunk.text,
      tokenEstimate: chunk.tokenEstimate,
      embedding: embeddings[index] ?? [],
    }));

    await this.chunksRepository.replaceChunks(uid, documentId, persisted);
    await this.documentsRepository.markIngestionSuccess(uid, documentId, {
      chunkCount: persisted.length,
      ...(extracted.pageCount !== undefined ? { pageCount: extracted.pageCount } : {}),
    });
    this.logger.log(
      `ingest ready uid=${uid} docId=${documentId} chunks=${persisted.length}${extracted.pageCount !== undefined ? ` pages=${extracted.pageCount}` : ''}`,
    );
  }

  private async embedInBatches(texts: string[]): Promise<number[][]> {
    const vectors: number[][] = [];
    for (let index = 0; index < texts.length; index += INGESTION_EMBED_BATCH_SIZE) {
      const batch = texts.slice(index, index + INGESTION_EMBED_BATCH_SIZE);
      const embedded = await this.embeddingPort.embed(batch);
      vectors.push(...embedded);
    }
    return vectors;
  }

  private resolveFailureCode(error: unknown): string {
    if (error instanceof LucyApiError) {
      return error.error;
    }
    if (error instanceof Error && /password/i.test(error.message)) {
      return LucyErrorCodes.DOCUMENT_PASSWORD_PROTECTED;
    }
    return LucyErrorCodes.DOCUMENT_PROCESSING_FAILED;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
