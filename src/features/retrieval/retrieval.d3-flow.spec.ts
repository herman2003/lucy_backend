import { Test, TestingModule } from '@nestjs/testing';

import { FirebaseAuthGuard } from '../../core/auth/firebase-auth.guard';
import { FirebaseAuthService } from '../../core/auth/firebase-auth.service';
import { EMBEDDING_PORT } from '../../core/llm/embedding.tokens';
import { LucyErrorCodes } from '../../core/errors/lucy-error-codes';
import { LUCY_CONFIG } from '../../core/config/app-config.module';
import { loadLucyConfig } from '../../core/config/lucy-config';
import { DOCUMENT_CHUNKS_REPOSITORY } from '../documents/repositories/document-chunks.repository.port';
import { InMemoryDocumentChunksRepository } from '../documents/repositories/in-memory-document-chunks.repository';
import { InMemoryDocumentsRepository } from '../documents/repositories/in-memory-documents.repository';
import { DOCUMENTS_REPOSITORY } from '../documents/repositories/documents.repository.port';
import { DOCUMENTS_STORAGE } from '../documents/storage/documents-storage.port';
import { InMemoryDocumentsStorage } from '../documents/storage/in-memory-documents.storage';
import { RetrievalFixtureEmbeddingAdapter } from './fixtures/retrieval-fixture-embedding.adapter';
import { makeFixtureChunk } from './fixtures/retrieval-fixture-vectors';
import { RetrievalController } from './retrieval.controller';
import { RetrievalService } from './services/retrieval.service';

/** DOC-14 / CP-D3 — retrieval with fixture vectors + EmbeddingPort test double (Q10). */
describe('Retrieval D3 flow (DOC-14)', () => {
  let controller: RetrievalController;
  let documentsRepo: InMemoryDocumentsRepository;
  let chunksRepo: InMemoryDocumentChunksRepository;
  const uid = 'dev-user-d3-flow';

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [RetrievalController],
      providers: [
        RetrievalService,
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
        { provide: EMBEDDING_PORT, useValue: new RetrievalFixtureEmbeddingAdapter(0) },
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

    controller = moduleRef.get(RetrievalController);
    documentsRepo = moduleRef.get(InMemoryDocumentsRepository);
    chunksRepo = moduleRef.get(InMemoryDocumentChunksRepository);
  });

  async function seedReadyDoc(input: {
    title: string;
    searchEnabled: boolean;
    chunks: ReturnType<typeof makeFixtureChunk>[];
  }): Promise<string> {
    const doc = await documentsRepo.create(uid, {
      title: input.title,
      fileName: 'fixture.txt',
      mimeType: 'text/plain',
      byteSize: 64,
    });
    await documentsRepo.markIngestionSuccess(uid, doc.id, {
      chunkCount: input.chunks.length,
    });
    if (input.searchEnabled) {
      await documentsRepo.setSearchEnabled(uid, doc.id, true);
    }
    await chunksRepo.replaceChunks(uid, doc.id, input.chunks);
    return doc.id;
  }

  it('ranks chunks by cosine score using fixture vectors (axis 0 query)', async () => {
    await seedReadyDoc({
      title: 'Biologie',
      searchEnabled: true,
      chunks: [
        makeFixtureChunk('c-match', 0, 'Extrait chlorophylle photosynthèse.', 0),
        makeFixtureChunk('c-other', 1, 'Extrait sans rapport.', 1),
      ],
    });

    const results = await controller.search({ user: { uid } } as never, {
      query: 'chlorophylle',
      limit: 5,
    });

    expect(results).toHaveLength(2);
    expect(results[0]?.chunkId).toBe('c-match');
    expect(results[0]?.score).toBeGreaterThan(results[1]!.score);
    expect(results[0]?.title).toBe('Biologie');
    expect(results[0]?.text).toContain('chlorophylle');
  });

  it('builds contextHeader with page range when chunk has pages', async () => {
    await seedReadyDoc({
      title: 'Manuel PDF',
      searchEnabled: true,
      chunks: [
        makeFixtureChunk('c-pdf', 0, 'Texte page deux.', 0, {
          pageStart: 2,
          pageEnd: 2,
        }),
      ],
    });

    const results = await controller.search({ user: { uid } } as never, {
      query: 'page',
    });

    expect(results[0]?.contextHeader).toBe(
      'Document: Manuel PDF\nPages: 2-2\n\nTexte page deux.',
    );
    expect(results[0]?.pageStart).toBe(2);
    expect(results[0]?.pageEnd).toBe(2);
  });

  it('returns empty when no searchEnabled ready documents', async () => {
    await seedReadyDoc({
      title: 'Archive',
      searchEnabled: false,
      chunks: [makeFixtureChunk('c1', 0, 'Contenu hors retrieval.', 0)],
    });

    const results = await controller.search({ user: { uid } } as never, {
      query: 'contenu',
    });

    expect(results).toEqual([]);
  });

  it('respects limit and optional documentIds filter', async () => {
    const idA = await seedReadyDoc({
      title: 'Doc A',
      searchEnabled: true,
      chunks: [
        makeFixtureChunk('a1', 0, 'Alpha un.', 0),
        makeFixtureChunk('a2', 1, 'Alpha deux.', 0),
        makeFixtureChunk('a3', 2, 'Alpha trois.', 0),
      ],
    });
    await seedReadyDoc({
      title: 'Doc B',
      searchEnabled: true,
      chunks: [makeFixtureChunk('b1', 0, 'Beta contenu.', 0)],
    });

    const limited = await controller.search({ user: { uid } } as never, {
      query: 'alpha',
      limit: 2,
    });
    expect(limited).toHaveLength(2);

    const scoped = await controller.search({ user: { uid } } as never, {
      query: 'alpha',
      documentIds: [idA],
    });
    expect(scoped.every((hit) => hit.documentId === idA)).toBe(true);
  });

  it('rejects missing query with VALIDATION_ERROR', async () => {
    await expect(
      controller.search({ user: { uid } } as never, { query: '   ' }),
    ).rejects.toMatchObject({
      statusCode: 400,
      error: LucyErrorCodes.VALIDATION_ERROR,
    });
  });
});
