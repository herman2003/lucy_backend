import { Test, TestingModule } from '@nestjs/testing';

import { AppConfigModule, LUCY_CONFIG } from '../../../core/config/app-config.module';
import { loadLucyConfig } from '../../../core/config/lucy-config';
import { EMBEDDING_PORT } from '../../../core/llm/embedding.tokens';
import { FakeEmbeddingAdapter } from '../../../core/llm/fake.embedding.adapter';
import { LLM_PORT } from '../../../core/llm/llm.tokens';
import type { LlmPort } from '../../../core/llm/llm.port';
import { LlmModule } from '../../../core/llm/llm.module';
import { PromptLoaderService } from '../../../core/prompt/prompt-loader.service';
import { PromptModule } from '../../../core/prompt/prompt.module';
import { InMemoryUsersStore } from '../../../core/persistence/in-memory-users.store';
import { LucyErrorCodes } from '../../../core/errors/lucy-error-codes';
import { LucyApiError } from '../../../core/errors/lucy-api.error';
import { InMemoryDocumentChunksRepository } from '../../documents/repositories/in-memory-document-chunks.repository';
import { InMemoryDocumentsRepository } from '../../documents/repositories/in-memory-documents.repository';
import { DOCUMENT_CHUNKS_REPOSITORY } from '../../documents/repositories/document-chunks.repository.port';
import { DOCUMENTS_REPOSITORY } from '../../documents/repositories/documents.repository.port';
import { DOCUMENTS_STORAGE } from '../../documents/storage/documents-storage.port';
import { InMemoryDocumentsStorage } from '../../documents/storage/in-memory-documents.storage';
import { InMemoryOnboardingUsersRepository } from '../../onboarding/repositories/in-memory-onboarding-user.repository';
import { InMemoryUsersProfileRepository } from '../../users/repositories/in-memory-users-profile.repository';
import { USERS_PROFILE_REPOSITORY } from '../../users/repositories/users.repository.port';
import { RetrievalService } from '../../retrieval/services/retrieval.service';
import { ChatPrerequisitesService } from '../../chat/services/chat-prerequisites.service';
import { InMemoryLearningSessionsRepository } from '../repositories/in-memory-learning-sessions.repository';
import { LEARNING_SESSIONS_REPOSITORY } from '../repositories/learning-sessions.repository.port';
import { LearningSessionsService } from './learning-sessions.service';

const validProfile = {
  primary_role: 'student' as const,
  main_domains: ['sciences' as const],
  learning_goal: 'exam' as const,
  self_assessed_level: 'intermediate' as const,
  explanation_style: 'step_by_step' as const,
  feedback_tone: 'encouraging' as const,
  tutoring_language: 'fr' as const,
};

describe('LearningSessionsService (LEARN-01b)', () => {
  let service: LearningSessionsService;
  let retrievalService: RetrievalService;
  let llmPort: LlmPort;
  let onboardingRepo: InMemoryOnboardingUsersRepository;
  let documentsRepo: InMemoryDocumentsRepository;
  let chunksRepo: InMemoryDocumentChunksRepository;
  const uid = 'dev-user-learning-generate';

  beforeEach(async () => {
    const usersStore = new InMemoryUsersStore();
    onboardingRepo = new InMemoryOnboardingUsersRepository(usersStore);

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppConfigModule, LlmModule, PromptModule],
      providers: [
        LearningSessionsService,
        ChatPrerequisitesService,
        RetrievalService,
        InMemoryLearningSessionsRepository,
        {
          provide: LEARNING_SESSIONS_REPOSITORY,
          useExisting: InMemoryLearningSessionsRepository,
        },
        {
          provide: USERS_PROFILE_REPOSITORY,
          useValue: new InMemoryUsersProfileRepository(usersStore),
        },
        InMemoryDocumentsStorage,
        InMemoryDocumentsRepository,
        InMemoryDocumentChunksRepository,
        { provide: DOCUMENTS_STORAGE, useExisting: InMemoryDocumentsStorage },
        { provide: DOCUMENTS_REPOSITORY, useExisting: InMemoryDocumentsRepository },
        {
          provide: DOCUMENT_CHUNKS_REPOSITORY,
          useExisting: InMemoryDocumentChunksRepository,
        },
        { provide: EMBEDDING_PORT, useClass: FakeEmbeddingAdapter },
      ],
    })
      .overrideProvider(LUCY_CONFIG)
      .useValue(
        loadLucyConfig({
          NODE_ENV: 'test',
          FIREBASE_AUTH_MODE: 'dev',
          LLM_PROVIDER: 'mock',
          FIRESTORE_PROVIDER: 'memory',
        }),
      )
      .compile();

    service = moduleRef.get(LearningSessionsService);
    retrievalService = moduleRef.get(RetrievalService);
    llmPort = moduleRef.get(LLM_PORT);
    documentsRepo = moduleRef.get(InMemoryDocumentsRepository);
    chunksRepo = moduleRef.get(InMemoryDocumentChunksRepository);
    moduleRef.get(PromptLoaderService).onModuleInit();
  });

  async function finalizeUserWithProfile(): Promise<void> {
    await onboardingRepo.saveAnalyzeSuccess(uid, validProfile, 'Résumé.');
    await onboardingRepo.finalizeOnboarding(uid);
  }

  async function seedReadyActiveDocumentWithChunk(): Promise<void> {
    const doc = await documentsRepo.create(uid, {
      title: 'Thermo',
      fileName: 't.txt',
      mimeType: 'text/plain',
      byteSize: 10,
    });
    await documentsRepo.updateStatus(uid, doc.id, 'ready');
    await documentsRepo.setSearchEnabled(uid, doc.id, true);
    await chunksRepo.replaceChunks(uid, doc.id, [
      {
        id: 'chunk_test_1',
        ordinal: 0,
        text: 'La entropie augmente dans un système isolé.',
        tokenEstimate: 12,
        pageStart: 1,
        pageEnd: 1,
        embedding: Array.from({ length: 768 }, () => 0.01),
      },
    ]);
  }

  async function seedReadyActiveDocumentWithTwoChunks(): Promise<string> {
    const doc = await documentsRepo.create(uid, {
      title: 'Thermo',
      fileName: 't.txt',
      mimeType: 'text/plain',
      byteSize: 10,
    });
    await documentsRepo.updateStatus(uid, doc.id, 'ready');
    await documentsRepo.setSearchEnabled(uid, doc.id, true);
    await chunksRepo.replaceChunks(uid, doc.id, [
      {
        id: 'chunk_0',
        ordinal: 0,
        text: 'La entropie augmente dans un système isolé.',
        tokenEstimate: 12,
        pageStart: 1,
        pageEnd: 1,
        embedding: Array.from({ length: 768 }, () => 0.01),
      },
      {
        id: 'chunk_1',
        ordinal: 1,
        text: "L'enthalpie mesure l'énergie interne plus la pression fois le volume.",
        tokenEstimate: 14,
        pageStart: 2,
        pageEnd: 2,
        embedding: Array.from({ length: 768 }, () => 0.02),
      },
    ]);
    return doc.id;
  }

  it('scopes quiz generation retrieval to selected focus areas (LEARN-07d)', async () => {
    await finalizeUserWithProfile();
    const documentId = await seedReadyActiveDocumentWithTwoChunks();
    const searchSpy = jest.spyOn(retrievalService, 'search');

    const session = await service.generate(uid, {
      type: 'quiz',
      itemCount: 5,
      focusAreas: [
        {
          id: 'focus_1',
          documentId,
          documentTitle: 'Thermo',
          label: 'Entropie',
          ordinalStart: 0,
          ordinalEnd: 0,
          importance: 'high',
          rationale: 'Concept central du cours.',
          keyConcepts: ['entropie'],
        },
      ],
    });

    expect(searchSpy).toHaveBeenCalledWith(
      uid,
      expect.objectContaining({
        documentIds: [documentId],
        query: expect.stringContaining('entropie'),
      }),
    );
    expect(session.items).toHaveLength(5);
    for (const item of session.items) {
      expect(item.sources.every((source) => source.chunkId === 'chunk_0')).toBe(true);
    }
    expect(session.title).toBe('Quiz · Entropie');
  });

  it('uses topicHint in the session title when focus areas are absent (LEARN-09a)', async () => {
    await finalizeUserWithProfile();
    await seedReadyActiveDocumentWithChunk();

    const session = await service.generate(uid, {
      type: 'flashcards',
      topicHint: 'entropie',
    });

    expect(session.title).toBe('Cartes · entropie');
  });

  it('returns actionable adviceKey when retrieval has no hits (LEARN-09b)', async () => {
    await finalizeUserWithProfile();
    await seedReadyActiveDocumentWithChunk();
    jest.spyOn(retrievalService, 'search').mockResolvedValue([]);

    await expect(service.generate(uid, { type: 'quiz' })).rejects.toMatchObject({
      statusCode: 502,
      error: LucyErrorCodes.LEARNING_GENERATION_FAILED,
      details: { adviceKey: 'no_retrieval_hits' },
    });
  });

  it('passes learner profile and difficulty guidance to quiz generation prompt (LEARN-07e)', async () => {
    await finalizeUserWithProfile();
    await seedReadyActiveDocumentWithChunk();
    const generateSpy = jest.spyOn(llmPort, 'generateStructured');

    await service.generate(uid, { type: 'quiz', itemCount: 5 });

    expect(generateSpy).toHaveBeenCalled();
    const call = generateSpy.mock.calls[0]?.[0];
    expect(call?.systemPrompt).toContain('learning_goal');
    expect(call?.systemPrompt).toContain('exam');
    expect(call?.systemPrompt).toContain('self_assessed_level');
    expect(call?.systemPrompt).toContain('intermediate');
    expect(call?.systemPrompt.toLowerCase()).toContain('intermediate difficulty');
  });

  it('generates a ready quiz session with 5 default items', async () => {
    await finalizeUserWithProfile();
    await seedReadyActiveDocumentWithChunk();

    const session = await service.generate(uid, { type: 'quiz' });

    expect(session.type).toBe('quiz');
    expect(session.status).toBe('ready');
    expect(session.itemCount).toBe(5);
    expect(session.items).toHaveLength(5);
    expect(session.items[0]).toMatchObject({
      id: 'item-1',
      choices: ['A', 'B', 'C', 'D'],
      sources: [
        expect.objectContaining({
          chunkId: 'chunk_test_1',
          documentId: expect.any(String),
        }),
      ],
    });
    expect(session.activeDocumentCount).toBe(1);
  });

  it('maps CHAT_NO_ACTIVE_DOCUMENTS to LEARNING_NO_ACTIVE_DOCUMENTS', async () => {
    await finalizeUserWithProfile();

    await expect(service.generate(uid, { type: 'quiz' })).rejects.toMatchObject({
      statusCode: 400,
      error: LucyErrorCodes.LEARNING_NO_ACTIVE_DOCUMENTS,
    });
  });

  it('maps CHAT_LEARNER_PROFILE_MISSING to LEARNING_LEARNER_PROFILE_MISSING', async () => {
    await seedReadyActiveDocumentWithChunk();

    await expect(service.generate(uid, { type: 'quiz' })).rejects.toMatchObject({
      statusCode: 400,
      error: LucyErrorCodes.LEARNING_LEARNER_PROFILE_MISSING,
    });
  });

  it('generates a ready flashcards session with 10 default items', async () => {
    await finalizeUserWithProfile();
    await seedReadyActiveDocumentWithChunk();

    const session = await service.generate(uid, { type: 'flashcards' });

    expect(session.type).toBe('flashcards');
    expect(session.status).toBe('ready');
    expect(session.itemCount).toBe(10);
    expect(session.items).toHaveLength(10);
    expect(session.items[0]).toMatchObject({
      id: 'item-1',
      front: 'Carte mock 1',
      back: 'Réponse mock 1',
      sources: [
        expect.objectContaining({
          chunkId: 'chunk_test_1',
          documentId: expect.any(String),
        }),
      ],
    });
    expect(session.title).toContain('Cartes ·');
  });
});

describe('LearningSessionsService getById (LEARN-01c)', () => {
  let service: LearningSessionsService;
  let onboardingRepo: InMemoryOnboardingUsersRepository;
  let documentsRepo: InMemoryDocumentsRepository;
  let chunksRepo: InMemoryDocumentChunksRepository;
  const uid = 'dev-user-learning-get';

  beforeEach(async () => {
    const usersStore = new InMemoryUsersStore();
    onboardingRepo = new InMemoryOnboardingUsersRepository(usersStore);

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppConfigModule, LlmModule, PromptModule],
      providers: [
        LearningSessionsService,
        ChatPrerequisitesService,
        RetrievalService,
        InMemoryLearningSessionsRepository,
        {
          provide: LEARNING_SESSIONS_REPOSITORY,
          useExisting: InMemoryLearningSessionsRepository,
        },
        {
          provide: USERS_PROFILE_REPOSITORY,
          useValue: new InMemoryUsersProfileRepository(usersStore),
        },
        InMemoryDocumentsStorage,
        InMemoryDocumentsRepository,
        InMemoryDocumentChunksRepository,
        { provide: DOCUMENTS_STORAGE, useExisting: InMemoryDocumentsStorage },
        { provide: DOCUMENTS_REPOSITORY, useExisting: InMemoryDocumentsRepository },
        {
          provide: DOCUMENT_CHUNKS_REPOSITORY,
          useExisting: InMemoryDocumentChunksRepository,
        },
        { provide: EMBEDDING_PORT, useClass: FakeEmbeddingAdapter },
      ],
    })
      .overrideProvider(LUCY_CONFIG)
      .useValue(
        loadLucyConfig({
          NODE_ENV: 'test',
          FIREBASE_AUTH_MODE: 'dev',
          LLM_PROVIDER: 'mock',
          FIRESTORE_PROVIDER: 'memory',
        }),
      )
      .compile();

    service = moduleRef.get(LearningSessionsService);
    documentsRepo = moduleRef.get(InMemoryDocumentsRepository);
    chunksRepo = moduleRef.get(InMemoryDocumentChunksRepository);
    moduleRef.get(PromptLoaderService).onModuleInit();
  });

  async function finalizeUserWithProfile(): Promise<void> {
    await onboardingRepo.saveAnalyzeSuccess(uid, validProfile, 'Résumé.');
    await onboardingRepo.finalizeOnboarding(uid);
  }

  async function seedReadyActiveDocumentWithChunk(): Promise<string> {
    const doc = await documentsRepo.create(uid, {
      title: 'Thermo',
      fileName: 't.txt',
      mimeType: 'text/plain',
      byteSize: 10,
    });
    await documentsRepo.updateStatus(uid, doc.id, 'ready');
    await documentsRepo.setSearchEnabled(uid, doc.id, true);
    await chunksRepo.replaceChunks(uid, doc.id, [
      {
        id: 'chunk_test_1',
        ordinal: 0,
        text: 'La entropie augmente dans un système isolé.',
        tokenEstimate: 12,
        pageStart: 1,
        pageEnd: 1,
        embedding: Array.from({ length: 768 }, () => 0.01),
      },
    ]);
    return doc.id;
  }

  it('returns a ready session for the owner without corpus guard', async () => {
    await finalizeUserWithProfile();
    await seedReadyActiveDocumentWithChunk();

    const created = await service.generate(uid, { type: 'quiz' });
    const loaded = await service.getById(uid, created.id);

    expect(loaded).toEqual(created);
    expect(loaded.items).toHaveLength(5);
  });

  it('throws LEARNING_SESSION_NOT_FOUND for unknown session id', async () => {
    await expect(service.getById(uid, 'learn_missing')).rejects.toMatchObject({
      statusCode: 404,
      error: LucyErrorCodes.LEARNING_SESSION_NOT_FOUND,
    });
  });

  it('returns session after all documents are disabled (G4b)', async () => {
    await finalizeUserWithProfile();
    const docId = await seedReadyActiveDocumentWithChunk();

    const created = await service.generate(uid, { type: 'quiz' });
    await documentsRepo.setSearchEnabled(uid, docId, false);

    const loaded = await service.getById(uid, created.id);
    expect(loaded.id).toBe(created.id);
    expect(loaded.items).toHaveLength(5);
  });

  it('does not return sessions owned by another user', async () => {
    await finalizeUserWithProfile();
    await seedReadyActiveDocumentWithChunk();

    const created = await service.generate(uid, { type: 'quiz' });

    await expect(service.getById('other-user', created.id)).rejects.toMatchObject({
      statusCode: 404,
      error: LucyErrorCodes.LEARNING_SESSION_NOT_FOUND,
    });
  });

  it('lists ready sessions newest first without corpus guard', async () => {
    await finalizeUserWithProfile();
    await seedReadyActiveDocumentWithChunk();

    const created = await service.generate(uid, { type: 'quiz' });
    const list = await service.list(uid);

    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe(created.id);
  });

  it('lists two generated sessions newest first', async () => {
    await finalizeUserWithProfile();
    await seedReadyActiveDocumentWithChunk();

    const quizSession = await service.generate(uid, { type: 'quiz' });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const flashcardsSession = await service.generate(uid, {
      type: 'flashcards',
    });

    const list = await service.list(uid);

    expect(list).toHaveLength(2);
    expect(list[0]?.id).toBe(flashcardsSession.id);
    expect(list[1]?.id).toBe(quizSession.id);
    expect(list.map((session) => session.type)).toEqual(['flashcards', 'quiz']);
  });

  it('deletes an owned session and returns not found afterwards', async () => {
    await finalizeUserWithProfile();
    await seedReadyActiveDocumentWithChunk();

    const created = await service.generate(uid, { type: 'quiz' });
    await service.delete(uid, created.id);

    await expect(service.getById(uid, created.id)).rejects.toMatchObject({
      statusCode: 404,
      error: LucyErrorCodes.LEARNING_SESSION_NOT_FOUND,
    });
    expect(await service.list(uid)).toEqual([]);
  });

  it('throws LEARNING_SESSION_NOT_FOUND when deleting unknown session', async () => {
    await expect(service.delete(uid, 'learn_missing')).rejects.toMatchObject({
      statusCode: 404,
      error: LucyErrorCodes.LEARNING_SESSION_NOT_FOUND,
    });
  });

  it('does not delete sessions owned by another user', async () => {
    await finalizeUserWithProfile();
    await seedReadyActiveDocumentWithChunk();

    const created = await service.generate(uid, { type: 'quiz' });

    await expect(service.delete('other-user', created.id)).rejects.toMatchObject({
      statusCode: 404,
      error: LucyErrorCodes.LEARNING_SESSION_NOT_FOUND,
    });
    expect(await service.getById(uid, created.id)).toEqual(created);
  });
});
