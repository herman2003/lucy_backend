import { Test, TestingModule } from '@nestjs/testing';

import { EMBEDDING_PORT } from '../../../core/llm/embedding.tokens';
import { FakeEmbeddingAdapter } from '../../../core/llm/fake.embedding.adapter';
import { LUCY_CONFIG } from '../../../core/config/app-config.module';
import { loadLucyConfig } from '../../../core/config/lucy-config';
import { LucyErrorCodes } from '../../../core/errors/lucy-error-codes';
import {
  DOCUMENT_CHUNKS_REPOSITORY,
} from '../repositories/document-chunks.repository.port';
import { DOCUMENTS_REPOSITORY } from '../repositories/documents.repository.port';
import { InMemoryDocumentChunksRepository } from '../repositories/in-memory-document-chunks.repository';
import { InMemoryDocumentsRepository } from '../repositories/in-memory-documents.repository';
import { DOCUMENTS_STORAGE } from '../storage/documents-storage.port';
import { InMemoryDocumentsStorage } from '../storage/in-memory-documents.storage';
import { DocumentChunkingService } from './document-chunking.service';
import { DocumentIngestionService } from './document-ingestion.service';
import { DocumentTextExtractorService } from './document-text-extractor.service';
import { DocumentsService } from './documents.service';

/** DOC-12 — ingestion unit + async job coverage (see also documents.d2-flow.spec.ts). */
describe('DocumentIngestionService', () => {
  let ingestionService: DocumentIngestionService;
  let documentsService: DocumentsService;
  let documentsRepository: InMemoryDocumentsRepository;
  let storage: InMemoryDocumentsStorage;
  let chunksRepository: InMemoryDocumentChunksRepository;
  const uid = 'user-ingestion-1';

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        DocumentIngestionService,
        DocumentTextExtractorService,
        DocumentChunkingService,
        InMemoryDocumentsStorage,
        InMemoryDocumentsRepository,
        InMemoryDocumentChunksRepository,
        {
          provide: DOCUMENTS_STORAGE,
          useExisting: InMemoryDocumentsStorage,
        },
        {
          provide: DOCUMENTS_REPOSITORY,
          useExisting: InMemoryDocumentsRepository,
        },
        {
          provide: DOCUMENT_CHUNKS_REPOSITORY,
          useExisting: InMemoryDocumentChunksRepository,
        },
        {
          provide: EMBEDDING_PORT,
          useClass: FakeEmbeddingAdapter,
        },
        {
          provide: LUCY_CONFIG,
          useValue: loadLucyConfig({
            NODE_ENV: 'development',
            LLM_PROVIDER: 'mock',
            FIRESTORE_PROVIDER: 'memory',
          }),
        },
      ],
    }).compile();

    documentsService = moduleRef.get(DocumentsService);
    ingestionService = moduleRef.get(DocumentIngestionService);
    documentsRepository = moduleRef.get(InMemoryDocumentsRepository);
    storage = moduleRef.get(InMemoryDocumentsStorage);
    chunksRepository = moduleRef.get(InMemoryDocumentChunksRepository);

    await ingestionService.onModuleInit();
  });

  async function flushIngestion(): Promise<void> {
    for (let attempt = 0; attempt < 50; attempt++) {
      const processing = await documentsRepository.listByStatus('processing');
      if (processing.length === 0) {
        return;
      }
      await sleep(20);
    }
    throw new Error('Ingestion did not complete in time');
  }

  it('persists document outline from headings during ingestion (LEARN-08a)', async () => {
    const text = [
      '# Chapitre 1 — Entropie',
      '',
      'Introduction sur l entropie.',
      '',
      '# Chapitre 2 — Enthalpie',
      '',
      'Suite du cours.',
    ].join('\n');
    const created = await documentsService.create(uid, {
      title: 'Cours',
      fileName: 'cours.md',
      mimeType: 'text/markdown',
      byteSize: Buffer.byteLength(text, 'utf8'),
    });

    const doc = await documentsRepository.getById(uid, created.id);
    storage.__setObject(
      doc!.storagePath,
      doc!.byteSize,
      'text/markdown',
      Buffer.from(text, 'utf8'),
    );

    await documentsService.complete(uid, created.id);
    await flushIngestion();

    const ready = await documentsRepository.getById(uid, created.id);
    expect(ready?.outline).toBeDefined();
    expect(ready?.outline?.length).toBeGreaterThanOrEqual(2);
    expect(ready?.outline?.[0]?.label).toContain('Entropie');

    const detail = await documentsService.getById(uid, created.id);
    expect(detail.outline?.[0]?.ordinalStart).toBe(0);
  });

  it('ingests txt after complete → ready with chunkCount', async () => {
    const text = 'Premier paragraphe.\n\nDeuxième paragraphe avec plus de texte.';
    const created = await documentsService.create(uid, {
      title: 'Notes',
      fileName: 'notes.txt',
      mimeType: 'text/plain',
      byteSize: Buffer.byteLength(text, 'utf8'),
    });

    const doc = await documentsRepository.getById(uid, created.id);
    storage.__setObject(
      doc!.storagePath,
      doc!.byteSize,
      'text/plain',
      Buffer.from(text, 'utf8'),
    );

    await documentsService.complete(uid, created.id);
    await flushIngestion();

    const ready = await documentsRepository.getById(uid, created.id);
    expect(ready?.status).toBe('ready');
    expect(ready?.chunkCount).toBeGreaterThan(0);

    const chunks = chunksRepository.listChunks(uid, created.id);
    expect(chunks.length).toBe(ready?.chunkCount);
    expect(chunks[0]?.embedding.length).toBeGreaterThan(0);
  });

  it('marks failed when extracted text exceeds max characters', async () => {
    const text = 'X'.repeat(1_500_001);
    const created = await documentsService.create(uid, {
      title: 'Huge',
      fileName: 'huge.txt',
      mimeType: 'text/plain',
      byteSize: text.length,
    });
    const doc = await documentsRepository.getById(uid, created.id);
    storage.__setObject(doc!.storagePath, doc!.byteSize, 'text/plain', Buffer.from(text, 'utf8'));

    await documentsService.complete(uid, created.id);
    await flushIngestion();

    const failed = await documentsRepository.getById(uid, created.id);
    expect(failed?.status).toBe('failed');
    expect(failed?.errorCode).toBe(LucyErrorCodes.DOCUMENT_TOO_LARGE);
  });

  it('complete on ready document is idempotent (no-op)', async () => {
    const text = 'Short text for idempotence check.';
    const created = await documentsService.create(uid, {
      title: 'Idem',
      fileName: 'idem.txt',
      mimeType: 'text/plain',
      byteSize: text.length,
    });
    const doc = await documentsRepository.getById(uid, created.id);
    storage.__setObject(doc!.storagePath, doc!.byteSize, 'text/plain', Buffer.from(text, 'utf8'));

    await documentsService.complete(uid, created.id);
    await flushIngestion();

    const second = await documentsService.complete(uid, created.id);
    expect(second.status).toBe('ready');
  });
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
