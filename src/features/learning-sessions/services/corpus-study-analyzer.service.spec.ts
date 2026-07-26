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

  async function seedReadyActiveDocument(
    targetDocumentsRepo: InMemoryDocumentsRepository = documentsRepo,
    targetChunksRepo: InMemoryDocumentChunksRepository = chunksRepo,
  ): Promise<string> {
    const doc = await targetDocumentsRepo.create(uid, {
      title: 'Thermodynamique',
      fileName: 't.txt',
      mimeType: 'text/plain',
      byteSize: 10,
    });
    await targetDocumentsRepo.updateStatus(uid, doc.id, 'ready');
    await targetDocumentsRepo.setSearchEnabled(uid, doc.id, true);
    await targetChunksRepo.replaceChunks(uid, doc.id, [
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

  it('includes document outlines in the LLM user prompt (LEARN-08b)', async () => {
    let capturedUserPrompt = '';
    const outlineAwareLlm: LlmPort = {
      generateStructured: async (input) => {
        capturedUserPrompt = input.userPrompt;
        const documentIdMatch = input.userPrompt.match(
          /DOCUMENTS_JSON=\[\{"id":"([^"]+)"/,
        );
        const documentId = documentIdMatch?.[1] ?? 'doc_missing';
        const focusArea = {
          id: 'focus_1',
          documentId,
          label: 'Chapitre 1 — Entropie',
          ordinalStart: 0,
          ordinalEnd: 0,
          pageStart: 1,
          pageEnd: 2,
          importance: 'high' as const,
          rationale: 'Fondations indispensables.',
          keyConcepts: ['entropie', 'second principe'],
        };
        return {
          rawText: JSON.stringify({ focusAreas: [focusArea] }),
          parsedJson: { focusAreas: [focusArea] },
        };
      },
    };

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
        { provide: LLM_PORT, useValue: outlineAwareLlm },
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

    const outlineService = moduleRef.get(CorpusStudyAnalyzerService);
    const outlineDocumentsRepo = moduleRef.get(InMemoryDocumentsRepository);
    const outlineChunksRepo = moduleRef.get(InMemoryDocumentChunksRepository);
    moduleRef.get(PromptLoaderService).onModuleInit();

    await onboardingRepo.saveAnalyzeSuccess(uid, validProfile, 'Résumé.');
    await onboardingRepo.finalizeOnboarding(uid);

    const doc = await outlineDocumentsRepo.create(uid, {
      title: 'Thermodynamique',
      fileName: 't.txt',
      mimeType: 'text/plain',
      byteSize: 10,
    });
    await outlineDocumentsRepo.updateStatus(uid, doc.id, 'ready');
    await outlineDocumentsRepo.setSearchEnabled(uid, doc.id, true);
    await outlineDocumentsRepo.markIngestionSuccess(uid, doc.id, {
      chunkCount: 2,
      outline: [
        {
          id: 'outline_1',
          label: 'Chapitre 1 — Entropie',
          level: 2,
          ordinalStart: 0,
          ordinalEnd: 0,
        },
      ],
    });
    await outlineChunksRepo.replaceChunks(uid, doc.id, [
      {
        id: 'chunk_0',
        ordinal: 0,
        text: 'Entropie et second principe.',
        tokenEstimate: 8,
        pageStart: 1,
        pageEnd: 2,
        embedding: Array.from({ length: 768 }, () => 0.02),
      },
    ]);

    await outlineService.analyze(uid);

    expect(capturedUserPrompt).toContain('DOCUMENT_OUTLINES_JSON=');
    expect(capturedUserPrompt).toContain('Chapitre 1 — Entropie');
    expect(capturedUserPrompt).toContain('chunk_0');
    expect(capturedUserPrompt).toContain('ALLOWED_CHUNK_ORDINALS_JSON=');
  });

  it('returns a synthetic plan when the LLM keeps failing validation', async () => {
    const failingLlm: LlmPort = {
      generateStructured: async () => {
        throw new Error('LLM unavailable');
      },
    };

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
        { provide: LLM_PORT, useValue: failingLlm },
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

    const fallbackService = moduleRef.get(CorpusStudyAnalyzerService);
    const fallbackDocumentsRepo = moduleRef.get(InMemoryDocumentsRepository);
    const fallbackChunksRepo = moduleRef.get(InMemoryDocumentChunksRepository);
    moduleRef.get(PromptLoaderService).onModuleInit();

    await onboardingRepo.saveAnalyzeSuccess(uid, validProfile, 'Résumé.');
    await onboardingRepo.finalizeOnboarding(uid);
    await seedReadyActiveDocument(fallbackDocumentsRepo, fallbackChunksRepo);

    const plan = await fallbackService.analyze(uid);

    expect(plan.focusAreas.length).toBeGreaterThanOrEqual(1);
    expect(plan.focusAreas[0]?.documentTitle).toBe('Thermodynamique');
  });

  it('clamps invalid ordinal ranges from the LLM instead of failing', async () => {
    let attempts = 0;
    const invalidOrdinalLlm: LlmPort = {
      generateStructured: async (input) => {
        attempts += 1;
        const documentIdMatch = input.userPrompt.match(
          /DOCUMENTS_JSON=\[\{"id":"([^"]+)"/,
        );
        const documentId = documentIdMatch?.[1] ?? 'doc_missing';
        const focusArea = {
          id: 'focus_1',
          documentId,
          label: 'Section inventée',
          ordinalStart: 9,
          ordinalEnd: 12,
          importance: 'high' as const,
          rationale: 'Important.',
          keyConcepts: ['concept'],
        };
        return {
          rawText: JSON.stringify({ focusAreas: [focusArea] }),
          parsedJson: { focusAreas: [focusArea] },
        };
      },
    };

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
        { provide: LLM_PORT, useValue: invalidOrdinalLlm },
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

    const clampService = moduleRef.get(CorpusStudyAnalyzerService);
    const clampDocumentsRepo = moduleRef.get(InMemoryDocumentsRepository);
    const clampChunksRepo = moduleRef.get(InMemoryDocumentChunksRepository);
    moduleRef.get(PromptLoaderService).onModuleInit();

    await onboardingRepo.saveAnalyzeSuccess(uid, validProfile, 'Résumé.');
    await onboardingRepo.finalizeOnboarding(uid);
    await seedReadyActiveDocument(clampDocumentsRepo, clampChunksRepo);

    const plan = await clampService.analyze(uid);

    expect(attempts).toBeGreaterThanOrEqual(1);
    expect(plan.focusAreas[0]?.ordinalStart).toBe(0);
    expect(plan.focusAreas[0]?.ordinalEnd).toBe(0);
  });
});
