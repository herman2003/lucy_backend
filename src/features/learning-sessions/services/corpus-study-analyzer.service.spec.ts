import { Test, TestingModule } from '@nestjs/testing';

import { AppConfigModule, LUCY_CONFIG } from '../../../core/config/app-config.module';
import { loadLucyConfig } from '../../../core/config/lucy-config';
import { EMBEDDING_PORT } from '../../../core/llm/embedding.tokens';
import { FakeEmbeddingAdapter } from '../../../core/llm/fake.embedding.adapter';
import { LlmModule } from '../../../core/llm/llm.module';
import { PromptLoaderService } from '../../../core/prompt/prompt-loader.service';
import { PromptModule } from '../../../core/prompt/prompt.module';
import { InMemoryUsersStore } from '../../../core/persistence/in-memory-users.store';
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
import { CorpusStudyAnalyzerService } from './corpus-study-analyzer.service';

const validProfile = {
  primary_role: 'student' as const,
  main_domains: ['sciences' as const],
  learning_goal: 'understand_course' as const,
  self_assessed_level: 'intermediate' as const,
  explanation_style: 'step_by_step' as const,
  feedback_tone: 'encouraging' as const,
  tutoring_language: 'fr' as const,
};

describe('CorpusStudyAnalyzerService (LEARN-07a)', () => {
  let service: CorpusStudyAnalyzerService;
  let onboardingRepo: InMemoryOnboardingUsersRepository;
  let documentsRepo: InMemoryDocumentsRepository;
  let chunksRepo: InMemoryDocumentChunksRepository;
  const uid = 'dev-user-corpus-study';

  beforeEach(async () => {
    const usersStore = new InMemoryUsersStore();
    onboardingRepo = new InMemoryOnboardingUsersRepository(usersStore);

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppConfigModule, LlmModule, PromptModule],
      providers: [
        CorpusStudyAnalyzerService,
        ChatPrerequisitesService,
        RetrievalService,
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

    service = moduleRef.get(CorpusStudyAnalyzerService);
    documentsRepo = moduleRef.get(InMemoryDocumentsRepository);
    chunksRepo = moduleRef.get(InMemoryDocumentChunksRepository);
    moduleRef.get(PromptLoaderService).onModuleInit();
  });

  async function finalizeUserWithProfile(): Promise<void> {
    await onboardingRepo.saveAnalyzeSuccess(uid, validProfile, 'Résumé.');
    await onboardingRepo.finalizeOnboarding(uid);
  }

  async function seedReadyActiveDocument(): Promise<string> {
    const doc = await documentsRepo.create(uid, {
      title: 'Thermodynamique',
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
        text: '## Chapitre 1 — Entropie et second principe.',
        tokenEstimate: 12,
        pageStart: 1,
        pageEnd: 2,
        embedding: Array.from({ length: 768 }, () => 0.02),
      },
    ]);
    return doc.id;
  }

  it('returns a study plan with validated focus areas', async () => {
    await finalizeUserWithProfile();
    const docId = await seedReadyActiveDocument();

    const plan = await service.analyze(uid);

    expect(plan.focusAreas.length).toBeGreaterThanOrEqual(1);
    expect(plan.focusAreas[0]).toMatchObject({
      documentId: docId,
      documentTitle: 'Thermodynamique',
      importance: 'high',
    });
    expect(plan.generatedAt).toBeTruthy();
    expect(new Date(plan.expiresAt).getTime()).toBeGreaterThan(
      new Date(plan.generatedAt).getTime(),
    );
  });
});
