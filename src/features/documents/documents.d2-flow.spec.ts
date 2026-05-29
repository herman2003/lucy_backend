import { Test, TestingModule } from '@nestjs/testing';

import { FirebaseAuthGuard } from '../../core/auth/firebase-auth.guard';
import { FirebaseAuthService } from '../../core/auth/firebase-auth.service';
import { EMBEDDING_PORT } from '../../core/llm/embedding.tokens';
import { FakeEmbeddingAdapter } from '../../core/llm/fake.embedding.adapter';
import { LUCY_CONFIG } from '../../core/config/app-config.module';
import { loadLucyConfig } from '../../core/config/lucy-config';
import { LucyErrorCodes } from '../../core/errors/lucy-error-codes';
import { DocumentsController } from './documents.controller';
import { DOCUMENT_CHUNKS_REPOSITORY } from './repositories/document-chunks.repository.port';
import { InMemoryDocumentChunksRepository } from './repositories/in-memory-document-chunks.repository';
import { InMemoryDocumentsRepository } from './repositories/in-memory-documents.repository';
import { DOCUMENTS_REPOSITORY } from './repositories/documents.repository.port';
import { DocumentChunkingService } from './services/document-chunking.service';
import { DocumentIngestionService } from './services/document-ingestion.service';
import { DocumentTextExtractorService } from './services/document-text-extractor.service';
import { DocumentsService } from './services/documents.service';
import { DOCUMENTS_STORAGE } from './storage/documents-storage.port';
import { InMemoryDocumentsStorage } from './storage/in-memory-documents.storage';

/** DOC-12 / CP-D2 — create → upload → complete → ingestion → ready + chunkCount. */
describe('Documents D2 flow (ingestion E2E)', () => {
  let controller: DocumentsController;
  let ingestionService: DocumentIngestionService;
  let repo: InMemoryDocumentsRepository;
  let storage: InMemoryDocumentsStorage;
  let chunksRepository: InMemoryDocumentChunksRepository;
  const uid = 'dev-user-d2-flow';

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [DocumentsController],
      providers: [
        DocumentsService,
        DocumentIngestionService,
        DocumentTextExtractorService,
        DocumentChunkingService,
        InMemoryDocumentsStorage,
        InMemoryDocumentsRepository,
        InMemoryDocumentChunksRepository,
        { provide: DOCUMENTS_STORAGE, useExisting: InMemoryDocumentsStorage },
        { provide: DOCUMENTS_REPOSITORY, useExisting: InMemoryDocumentsRepository },
        {
          provide: DOCUMENT_CHUNKS_REPOSITORY,
          useExisting: InMemoryDocumentChunksRepository,
        },
        { provide: FirebaseAuthService, useValue: { verifyIdToken: jest.fn() } },
        { provide: EMBEDDING_PORT, useClass: FakeEmbeddingAdapter },
        {
          provide: LUCY_CONFIG,
          useValue: loadLucyConfig({
            NODE_ENV: 'development',
            LLM_PROVIDER: 'mock',
            FIREBASE_AUTH_MODE: 'dev',
            FIRESTORE_PROVIDER: 'memory',
          }),
        },
      ],
    })
      .overrideGuard(FirebaseAuthGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => { getRequest: () => { user?: { uid: string } } };
        }) => {
          context.switchToHttp().getRequest().user = { uid };
          return true;
        },
      })
      .compile();

    controller = moduleRef.get(DocumentsController);
    ingestionService = moduleRef.get(DocumentIngestionService);
    repo = moduleRef.get(InMemoryDocumentsRepository);
    storage = moduleRef.get(InMemoryDocumentsStorage);
    chunksRepository = moduleRef.get(InMemoryDocumentChunksRepository);

    await ingestionService.onModuleInit();
  });

  async function flushIngestion(): Promise<void> {
    for (let attempt = 0; attempt < 50; attempt++) {
      const processing = await repo.listByStatus('processing');
      if (processing.length === 0) {
        return;
      }
      await sleep(20);
    }
    throw new Error('Ingestion did not complete in time');
  }

  it('txt with two paragraphs → ready with chunkCount >= 1 on list and detail', async () => {
    const text = 'Premier paragraphe du cours.\n\nDeuxième paragraphe avec détails.';
    const created = await controller.createDocument({ user: { uid } } as never, {
      title: 'Cours',
      fileName: 'cours.txt',
      mimeType: 'text/plain',
      byteSize: Buffer.byteLength(text, 'utf8'),
    });

    const doc = await repo.getById(uid, created.id);
    storage.__setObject(
      doc!.storagePath,
      doc!.byteSize,
      'text/plain',
      Buffer.from(text, 'utf8'),
    );

    await controller.completeDocument({ user: { uid } } as never, created.id);
    await flushIngestion();

    const list = await controller.listDocuments({ user: { uid } } as never);
    const listed = list.find((item) => item.id === created.id);
    expect(listed?.status).toBe('ready');
    expect(listed?.chunkCount).toBeGreaterThanOrEqual(1);

    const detail = await controller.getDocument({ user: { uid } } as never, created.id);
    expect(detail.status).toBe('ready');
    expect(detail.chunkCount).toBeGreaterThanOrEqual(1);

    const chunks = chunksRepository.listChunks(uid, created.id);
    expect(chunks.length).toBe(detail.chunkCount);
    expect(chunks[0]?.text).toContain('Premier paragraphe');
  });

  it('MIME mismatch at complete → failed visible on list with errorCode', async () => {
    const created = await controller.createDocument({ user: { uid } } as never, {
      title: 'Bad PDF',
      fileName: 'doc.pdf',
      mimeType: 'application/pdf',
      byteSize: 100,
    });
    repo.__setStorageObjectPresent(uid, created.id, true, 'text/plain');

    await expect(
      controller.completeDocument({ user: { uid } } as never, created.id),
    ).rejects.toMatchObject({
      statusCode: 422,
      error: LucyErrorCodes.DOCUMENT_TYPE_MISMATCH,
    });

    const list = await controller.listDocuments({ user: { uid } } as never);
    const listed = list.find((item) => item.id === created.id);
    expect(listed?.status).toBe('failed');
    expect(listed?.errorCode).toBe(LucyErrorCodes.DOCUMENT_TYPE_MISMATCH);
  });
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
