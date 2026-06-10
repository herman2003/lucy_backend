import { Test, TestingModule } from '@nestjs/testing';

import { FirebaseAuthGuard } from '../../core/auth/firebase-auth.guard';
import { FirebaseAuthService } from '../../core/auth/firebase-auth.service';
import { EMBEDDING_PORT } from '../../core/llm/embedding.tokens';
import { FakeEmbeddingAdapter } from '../../core/llm/fake.embedding.adapter';
import { LUCY_CONFIG } from '../../core/config/app-config.module';
import { loadLucyConfig } from '../../core/config/lucy-config';
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

describe('DocumentsController reprocess', () => {
  let controller: DocumentsController;
  let repo: InMemoryDocumentsRepository;
  const uid = 'dev-user-reprocess';

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
    repo = moduleRef.get(InMemoryDocumentsRepository);
  });

  it('POST /documents/:id/reprocess moves failed doc to processing', async () => {
    const created = await controller.createDocument({ user: { uid } } as never, {
      title: 'Notes',
      fileName: 'notes.txt',
      mimeType: 'text/plain',
      byteSize: 20,
    });
    repo.__setStorageObjectPresent(uid, created.id, true);
    await repo.markIngestionFailed(uid, created.id, 'DOCUMENT_EMPTY_EXTRACTION');

    const result = await controller.reprocessDocument(
      { user: { uid } } as never,
      created.id,
    );

    expect(result.status).toBe('processing');
    const listed = await controller.listDocuments({ user: { uid } } as never);
    expect(listed[0]?.status).toBe('processing');
  });
});
