import { Test, TestingModule } from '@nestjs/testing';

import { AppConfigModule, LUCY_CONFIG } from '../../../core/config/app-config.module';
import { loadLucyConfig } from '../../../core/config/lucy-config';
import { EMBEDDING_PORT } from '../../../core/llm/embedding.tokens';
import { FakeEmbeddingAdapter } from '../../../core/llm/fake.embedding.adapter';
import { LlmModule } from '../../../core/llm/llm.module';
import { PromptLoaderService } from '../../../core/prompt/prompt-loader.service';
import { PromptModule } from '../../../core/prompt/prompt.module';
import { InMemoryUsersStore } from '../../../core/persistence/in-memory-users.store';
import { LucyErrorCodes } from '../../../core/errors/lucy-error-codes';
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

  it('rejects flashcards generation in LEARN-01b', async () => {
    await finalizeUserWithProfile();
    await seedReadyActiveDocumentWithChunk();

    await expect(
      service.generate(uid, { type: 'flashcards', itemCount: 10 }),
    ).rejects.toMatchObject({
      statusCode: 400,
      error: LucyErrorCodes.LEARNING_VALIDATION_ERROR,
    });
  });
});
