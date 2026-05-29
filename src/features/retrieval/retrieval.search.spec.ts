import { Test, TestingModule } from '@nestjs/testing';

import { FirebaseAuthGuard } from '../../core/auth/firebase-auth.guard';
import { FirebaseAuthService } from '../../core/auth/firebase-auth.service';
import { EMBEDDING_PORT } from '../../core/llm/embedding.tokens';
import { FakeEmbeddingAdapter } from '../../core/llm/fake.embedding.adapter';
import { LUCY_CONFIG } from '../../core/config/app-config.module';
import { loadLucyConfig } from '../../core/config/lucy-config';
import { DocumentsController } from '../documents/documents.controller';
import { DOCUMENT_CHUNKS_REPOSITORY } from '../documents/repositories/document-chunks.repository.port';
import { InMemoryDocumentChunksRepository } from '../documents/repositories/in-memory-document-chunks.repository';
import { InMemoryDocumentsRepository } from '../documents/repositories/in-memory-documents.repository';
import { DOCUMENTS_REPOSITORY } from '../documents/repositories/documents.repository.port';
import { DocumentChunkingService } from '../documents/services/document-chunking.service';
import { DocumentIngestionService } from '../documents/services/document-ingestion.service';
import { DocumentTextExtractorService } from '../documents/services/document-text-extractor.service';
import { DocumentsService } from '../documents/services/documents.service';
import { DOCUMENTS_STORAGE } from '../documents/storage/documents-storage.port';
import { InMemoryDocumentsStorage } from '../documents/storage/in-memory-documents.storage';
import { RetrievalController } from './retrieval.controller';
import { RetrievalService } from './services/retrieval.service';

/** DOC-13/14 — E2E retrieval after ingestion with {@link FakeEmbeddingAdapter} (Q10). */
describe('Retrieval search E2E after ingestion', () => {
  let retrievalController: RetrievalController;
  let documentsController: DocumentsController;
  let ingestionService: DocumentIngestionService;
  let repo: InMemoryDocumentsRepository;
  let storage: InMemoryDocumentsStorage;
  const uid = 'dev-user-retrieval';

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [DocumentsController, RetrievalController],
      providers: [
        DocumentsService,
        RetrievalService,
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

    retrievalController = moduleRef.get(RetrievalController);
    documentsController = moduleRef.get(DocumentsController);
    ingestionService = moduleRef.get(DocumentIngestionService);
    repo = moduleRef.get(InMemoryDocumentsRepository);
    storage = moduleRef.get(InMemoryDocumentsStorage);
    await ingestionService.onModuleInit();
  });

  async function ingestReadyDoc(
    title: string,
    text: string,
    searchEnabled: boolean,
  ): Promise<string> {
    const created = await documentsController.createDocument({ user: { uid } } as never, {
      title,
      fileName: 'note.txt',
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
    await documentsController.completeDocument({ user: { uid } } as never, created.id);
    for (let attempt = 0; attempt < 50; attempt++) {
      const processing = await repo.listByStatus('processing');
      if (processing.length === 0) {
        break;
      }
      await sleep(20);
    }
    if (searchEnabled) {
      await documentsController.patchDocument({ user: { uid } } as never, created.id, {
        searchEnabled: true,
      });
    }
    return created.id;
  }

  it('returns top-k from searchEnabled ready docs with contextHeader', async () => {
    const activeId = await ingestReadyDoc(
      'Cours actif',
      'Le chloroplaste contient la chlorophylle pour la photosynthèse.',
      true,
    );
    await ingestReadyDoc(
      'Cours inactif',
      'Ce texte ne doit pas apparaître dans la recherche vectorielle.',
      false,
    );

    const results = await retrievalController.search({ user: { uid } } as never, {
      query: 'chlorophylle photosynthèse',
      limit: 3,
    });

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.every((hit) => hit.documentId === activeId)).toBe(true);
    expect(results[0]?.title).toBe('Cours actif');
    expect(results[0]?.contextHeader).toContain('Document: Cours actif');
    expect(results[0]?.contextHeader).toContain(results[0]!.text);
    expect(typeof results[0]?.score).toBe('number');
    expect(results[0]?.chunkId).toBeTruthy();
  });

  it('filters by documentIds when provided', async () => {
    const idA = await ingestReadyDoc('Doc A', 'Contenu unique alpha zéro.', true);
    const idB = await ingestReadyDoc('Doc B', 'Contenu unique beta un.', true);

    const results = await retrievalController.search({ user: { uid } } as never, {
      query: 'unique alpha',
      documentIds: [idA],
    });

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.every((hit) => hit.documentId === idA)).toBe(true);
    expect(results.some((hit) => hit.documentId === idB)).toBe(false);
  });
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
