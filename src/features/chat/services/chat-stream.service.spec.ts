import { Test, TestingModule } from '@nestjs/testing';

import { AppConfigModule, LUCY_CONFIG } from '../../../core/config/app-config.module';
import { loadLucyConfig } from '../../../core/config/lucy-config';
import { EMBEDDING_PORT } from '../../../core/llm/embedding.tokens';
import { FakeEmbeddingAdapter } from '../../../core/llm/fake.embedding.adapter';
import { LlmModule } from '../../../core/llm/llm.module';
import { MOCK_STREAM_DELTAS, MOCK_STREAM_FULL_TEXT } from '../../../core/llm/mock.llm-streaming.adapter';
import { buildOffCorpusAssistantReply } from '../utils/chat-off-corpus-reply';
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
import { CorpusStudyAnalyzerService } from '../../learning-sessions/services/corpus-study-analyzer.service';
import { LearningSessionsService } from '../../learning-sessions/services/learning-sessions.service';
import { InMemoryLearningSessionsRepository } from '../../learning-sessions/repositories/in-memory-learning-sessions.repository';
import { LEARNING_SESSIONS_REPOSITORY } from '../../learning-sessions/repositories/learning-sessions.repository.port';
import { DEFAULT_CHAT_TITLE } from '../dto/create-chat.dto';
import type { ChatSseEvent } from '../domain/chat-sse.types';
import { InMemoryChatsRepository } from '../repositories/in-memory-chats.repository';
import { CHATS_REPOSITORY } from '../repositories/chats.repository.port';
import { ChatActiveStreamRegistry } from './chat-active-stream.registry';
import { ChatPrerequisitesService } from './chat-prerequisites.service';
import { ChatRagService } from './chat-rag.service';
import { ChatStreamService } from './chat-stream.service';
import { ChatService } from './chat.service';

const validProfile = {
  primary_role: 'student' as const,
  main_domains: ['sciences' as const],
  learning_goal: 'exam' as const,
  self_assessed_level: 'intermediate' as const,
  explanation_style: 'step_by_step' as const,
  feedback_tone: 'encouraging' as const,
  tutoring_language: 'fr' as const,
};

async function collectSseEvents(
  generator: AsyncGenerator<ChatSseEvent>,
): Promise<ChatSseEvent[]> {
  const events: ChatSseEvent[] = [];
  for await (const event of generator) {
    events.push(event);
  }
  return events;
}

function waitForNextEventLoopTick(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

describe('ChatStreamService (CHAT-05)', () => {
  let streamService: ChatStreamService;
  let activeStreams: ChatActiveStreamRegistry;
  let chatsRepository: InMemoryChatsRepository;
  let learningSessionsService: LearningSessionsService;
  let documentsRepo: InMemoryDocumentsRepository;
  let chunksRepo: InMemoryDocumentChunksRepository;
  let onboardingRepo: InMemoryOnboardingUsersRepository;
  const uid = 'dev-user-chat-stream';

  beforeEach(async () => {
    const usersStore = new InMemoryUsersStore();
    onboardingRepo = new InMemoryOnboardingUsersRepository(usersStore);

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppConfigModule, LlmModule, PromptModule],
      providers: [
        ChatStreamService,
        ChatService,
        ChatRagService,
        ChatActiveStreamRegistry,
        ChatPrerequisitesService,
        RetrievalService,
        CorpusStudyAnalyzerService,
        LearningSessionsService,
        InMemoryLearningSessionsRepository,
        {
          provide: LEARNING_SESSIONS_REPOSITORY,
          useExisting: InMemoryLearningSessionsRepository,
        },
        InMemoryChatsRepository,
        { provide: CHATS_REPOSITORY, useExisting: InMemoryChatsRepository },
        { provide: USERS_PROFILE_REPOSITORY, useValue: new InMemoryUsersProfileRepository(usersStore) },
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

    streamService = moduleRef.get(ChatStreamService);
    activeStreams = moduleRef.get(ChatActiveStreamRegistry);
    chatsRepository = moduleRef.get(InMemoryChatsRepository);
    learningSessionsService = moduleRef.get(LearningSessionsService);
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

  async function seedReadyActiveDocumentWithoutChunks(): Promise<void> {
    const doc = await documentsRepo.create(uid, {
      title: 'Empty',
      fileName: 'e.txt',
      mimeType: 'text/plain',
      byteSize: 10,
    });
    await documentsRepo.updateStatus(uid, doc.id, 'ready');
    await documentsRepo.setSearchEnabled(uid, doc.id, true);
    await chunksRepo.replaceChunks(uid, doc.id, []);
  }

  it('assertCanStream throws CHAT_NO_ACTIVE_DOCUMENTS before SSE when corpus empty', async () => {
    await finalizeUserWithProfile();
    const thread = await chatsRepository.createThread(uid, DEFAULT_CHAT_TITLE);

    await expect(streamService.assertCanStream(uid, thread.id)).rejects.toMatchObject({
      statusCode: 409,
      error: LucyErrorCodes.CHAT_NO_ACTIVE_DOCUMENTS,
    });
  });

  it('emits user_message, text_delta, sources, done with mock stream', async () => {
    await finalizeUserWithProfile();
    await seedReadyActiveDocumentWithChunk();
    const thread = await chatsRepository.createThread(uid, DEFAULT_CHAT_TITLE);

    const events = await collectSseEvents(
      streamService.streamMessage(uid, thread.id, 'Qu’est-ce que l’entropie ?'),
    );

    const eventNames = events.map((event) => event.event);
    expect(eventNames).toEqual(['user_message', 'text_delta', 'text_delta', 'text_delta', 'text_delta', 'sources', 'done']);

    const deltas = events
      .filter((event) => event.event === 'text_delta')
      .map((event) => event.data.delta);
    expect(deltas).toEqual([...MOCK_STREAM_DELTAS]);
    expect(deltas.join('')).toBe(MOCK_STREAM_FULL_TEXT);

    const sourcesEvent = events.find((event) => event.event === 'sources');
    expect(sourcesEvent?.data.sources).toHaveLength(1);
    expect(sourcesEvent?.data.sources[0]?.chunkId).toBe('chunk_test_1');

    const doneEvent = events.find((event) => event.event === 'done');
    expect(doneEvent?.data.assistantMessage.content).toBe(MOCK_STREAM_FULL_TEXT);
    expect(doneEvent?.data.assistantMessage.sources).toHaveLength(1);

    const updatedThread = await chatsRepository.getThread(uid, thread.id);
    expect(updatedThread?.title).toBe('Qu’est-ce que l’entropie ?');
  });

  it('sendMessage returns user and assistant messages without SSE', async () => {
    await finalizeUserWithProfile();
    await seedReadyActiveDocumentWithoutChunks();
    const thread = await chatsRepository.createThread(uid, DEFAULT_CHAT_TITLE);

    const result = await streamService.sendMessage(uid, thread.id, 'Question JSON');

    expect(result.userMessage.role).toBe('user');
    expect(result.assistantMessage.role).toBe('assistant');
    expect(result.assistantMessage.status).toBe('completed');
    expect(result.assistantMessage.content).toBe(buildOffCorpusAssistantReply('fr'));
  });

  it('assertCanStream throws CHAT_STREAM_IN_PROGRESS when a stream is active', async () => {
    await finalizeUserWithProfile();
    await seedReadyActiveDocumentWithoutChunks();
    const thread = await chatsRepository.createThread(uid, DEFAULT_CHAT_TITLE);
    activeStreams.acquire(uid, thread.id);

    await expect(streamService.assertCanStream(uid, thread.id)).rejects.toMatchObject({
      error: LucyErrorCodes.CHAT_STREAM_IN_PROGRESS,
    });

    activeStreams.release(uid, thread.id);
  });

  it('streams with empty sources when retrieval returns no hits', async () => {
    await finalizeUserWithProfile();
    await seedReadyActiveDocumentWithoutChunks();
    const thread = await chatsRepository.createThread(uid, DEFAULT_CHAT_TITLE);

    const events = await collectSseEvents(
      streamService.streamMessage(uid, thread.id, 'Question sans extraits'),
    );

    const sourcesEvent = events.find((event) => event.event === 'sources');
    expect(sourcesEvent?.data.sources).toEqual([]);

    const doneEvent = events.find((event) => event.event === 'done');
    expect(doneEvent?.data.assistantMessage.sources).toEqual([]);
    expect(doneEvent?.data.assistantMessage.content).toBe(
      buildOffCorpusAssistantReply('fr'),
    );
    expect(doneEvent?.data.assistantMessage.content).toContain(
      'ne figure pas dans vos documents',
    );
  });
});

describe('ChatStreamService learning generation (LEARN-01d)', () => {
  let streamService: ChatStreamService;
  let chatsRepository: InMemoryChatsRepository;
  let learningSessionsService: LearningSessionsService;
  let corpusStudyAnalyzer: CorpusStudyAnalyzerService;
  let documentsRepo: InMemoryDocumentsRepository;
  let chunksRepo: InMemoryDocumentChunksRepository;
  let onboardingRepo: InMemoryOnboardingUsersRepository;
  const uid = 'dev-user-chat-learning';

  beforeEach(async () => {
    const usersStore = new InMemoryUsersStore();
    onboardingRepo = new InMemoryOnboardingUsersRepository(usersStore);

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppConfigModule, LlmModule, PromptModule],
      providers: [
        ChatStreamService,
        ChatService,
        ChatRagService,
        ChatActiveStreamRegistry,
        ChatPrerequisitesService,
        RetrievalService,
        CorpusStudyAnalyzerService,
        LearningSessionsService,
        InMemoryLearningSessionsRepository,
        {
          provide: LEARNING_SESSIONS_REPOSITORY,
          useExisting: InMemoryLearningSessionsRepository,
        },
        InMemoryChatsRepository,
        { provide: CHATS_REPOSITORY, useExisting: InMemoryChatsRepository },
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

    streamService = moduleRef.get(ChatStreamService);
    chatsRepository = moduleRef.get(InMemoryChatsRepository);
    learningSessionsService = moduleRef.get(LearningSessionsService);
    corpusStudyAnalyzer = moduleRef.get(CorpusStudyAnalyzerService);
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
        id: 'chunk_0',
        ordinal: 0,
        text: 'La entropie augmente dans un système isolé.',
        tokenEstimate: 12,
        pageStart: 1,
        pageEnd: 1,
        embedding: Array.from({ length: 768 }, () => 0.01),
      },
    ]);
  }

  it('runs corpus analysis after quiz confirmation (LEARN-07b)', async () => {
    await finalizeUserWithProfile();
    await seedReadyActiveDocumentWithChunk();
    const thread = await chatsRepository.createThread(uid, DEFAULT_CHAT_TITLE);
    const analyzeSpy = jest.spyOn(corpusStudyAnalyzer, 'analyze');

    await collectSseEvents(
      streamService.streamMessage(uid, thread.id, 'fais-moi un quiz'),
    );
    const events = await collectSseEvents(
      streamService.streamMessage(uid, thread.id, 'oui'),
    );

    expect(analyzeSpy).toHaveBeenCalledTimes(1);

    const doneEvent = events.find((event) => event.event === 'done');
    expect(doneEvent?.data.assistantMessage.content).toContain(
      'Je parcours tes documents',
    );
    expect(doneEvent?.data.assistantMessage.content).toContain('**1.**');

    const updatedThread = await chatsRepository.getThread(uid, thread.id);
    expect(updatedThread?.pendingLearningGeneration).toMatchObject({
      type: 'quiz',
      step: 'awaiting_focus_selection',
    });
    expect(updatedThread?.corpusStudyPlan?.focusAreas.length).toBeGreaterThanOrEqual(1);
  });

  it('streams analyzing text before corpus analysis finishes (LEARN-06e)', async () => {
    await finalizeUserWithProfile();
    await seedReadyActiveDocumentWithChunk();
    const thread = await chatsRepository.createThread(uid, DEFAULT_CHAT_TITLE);

    let releaseAnalyze: (() => void) | undefined;
    const analyzeGate = new Promise<void>((resolve) => {
      releaseAnalyze = resolve;
    });
    jest.spyOn(corpusStudyAnalyzer, 'analyze').mockImplementation(async () => {
      await analyzeGate;
      return {
        generatedAt: '2026-06-10T12:00:00.000Z',
        expiresAt: '2026-06-11T12:00:00.000Z',
        focusAreas: [
          {
            id: 'focus_1',
            documentId: 'doc_mock',
            documentTitle: 'Thermo',
            label: 'Partie essentielle',
            ordinalStart: 0,
            ordinalEnd: 0,
            importance: 'high' as const,
            rationale: 'Base du cours.',
            keyConcepts: ['entropie'],
          },
        ],
      };
    });

    await collectSseEvents(
      streamService.streamMessage(uid, thread.id, 'fais-moi un quiz'),
    );

    const events: ChatSseEvent[] = [];
    let sawAnalyzingDeltaBeforeDone = false;
    const stream = streamService.streamMessage(uid, thread.id, 'oui');
    const collector = (async () => {
      for await (const event of stream) {
        events.push(event);
        if (
          event.event === 'text_delta' &&
          event.data.delta.includes('Je parcours tes documents')
        ) {
          sawAnalyzingDeltaBeforeDone = true;
        }
      }
    })();

    await waitForNextEventLoopTick();
    await waitForNextEventLoopTick();
    expect(sawAnalyzingDeltaBeforeDone).toBe(true);
    expect(events.some((event) => event.event === 'done')).toBe(false);

    releaseAnalyze?.();
    await collector;
    expect(events.some((event) => event.event === 'done')).toBe(true);
  });

  it('reuses cached corpusStudyPlan within TTL (LEARN-07b)', async () => {
    await finalizeUserWithProfile();
    await seedReadyActiveDocumentWithChunk();
    const thread = await chatsRepository.createThread(uid, DEFAULT_CHAT_TITLE);
    const analyzeSpy = jest.spyOn(corpusStudyAnalyzer, 'analyze');

    await collectSseEvents(
      streamService.streamMessage(uid, thread.id, 'fais-moi un quiz'),
    );
    await collectSseEvents(streamService.streamMessage(uid, thread.id, 'oui'));
    await collectSseEvents(streamService.streamMessage(uid, thread.id, 'annule'));

    await collectSseEvents(
      streamService.streamMessage(uid, thread.id, 'fais-moi un quiz'),
    );
    await collectSseEvents(streamService.streamMessage(uid, thread.id, 'oui'));

    expect(analyzeSpy).toHaveBeenCalledTimes(1);
  });

  it('asks for confirmation before generating a quiz', async () => {
    await finalizeUserWithProfile();
    await seedReadyActiveDocumentWithChunk();
    const thread = await chatsRepository.createThread(uid, DEFAULT_CHAT_TITLE);
    const generateSpy = jest.spyOn(learningSessionsService, 'generate');

    const events = await collectSseEvents(
      streamService.streamMessage(uid, thread.id, 'fais-moi un quiz'),
    );

    expect(generateSpy).not.toHaveBeenCalled();

    const doneEvent = events.find((event) => event.event === 'done');
    expect(doneEvent?.data.assistantMessage.content).toContain('quiz');
    expect(doneEvent?.data.assistantMessage.content).toContain('c’est bien ça');

    const updatedThread = await chatsRepository.getThread(uid, thread.id);
    expect(updatedThread?.pendingLearningGeneration).toMatchObject({
      type: 'quiz',
      step: 'awaiting_confirm',
    });
  });

  it('creates a quiz session after multi-turn dialogue', async () => {
    await finalizeUserWithProfile();
    await seedReadyActiveDocumentWithChunk();
    const thread = await chatsRepository.createThread(uid, DEFAULT_CHAT_TITLE);
    const generateSpy = jest.spyOn(learningSessionsService, 'generate');

    await collectSseEvents(
      streamService.streamMessage(uid, thread.id, 'fais-moi un quiz'),
    );
    await collectSseEvents(streamService.streamMessage(uid, thread.id, 'oui'));
    await collectSseEvents(streamService.streamMessage(uid, thread.id, '1'));
    await collectSseEvents(streamService.streamMessage(uid, thread.id, '5'));
    const events = await collectSseEvents(
      streamService.streamMessage(uid, thread.id, 'oui'),
    );

    expect(generateSpy).toHaveBeenCalledWith(uid, {
      type: 'quiz',
      itemCount: 5,
      sourceChatId: thread.id,
      focusAreas: expect.arrayContaining([
        expect.objectContaining({
          id: expect.any(String),
          documentId: expect.any(String),
        }),
      ]),
    });

    const createdEvent = events.find(
      (event) => event.event === 'learning_session_created',
    );
    expect(createdEvent?.data).toMatchObject({
      type: 'quiz',
      title: expect.stringContaining('Quiz ·'),
    });

    const doneEvent = events.find((event) => event.event === 'done');
    expect(doneEvent?.data.assistantMessage.content).toContain('Ton quiz est prêt');

    const updatedThread = await chatsRepository.getThread(uid, thread.id);
    expect(updatedThread?.pendingLearningGeneration).toBeUndefined();
  });

  it('creates flashcards session from chat and emits learning_session_created SSE', async () => {
    await finalizeUserWithProfile();
    await seedReadyActiveDocumentWithChunk();
    const thread = await chatsRepository.createThread(uid, DEFAULT_CHAT_TITLE);
    const generateSpy = jest.spyOn(learningSessionsService, 'generate');

    await collectSseEvents(
      streamService.streamMessage(uid, thread.id, 'fais-moi des cartes mémoire'),
    );
    await collectSseEvents(streamService.streamMessage(uid, thread.id, 'oui'));
    await collectSseEvents(streamService.streamMessage(uid, thread.id, 'tout'));
    await collectSseEvents(
      streamService.streamMessage(uid, thread.id, 'comme tu veux'),
    );
    const events = await collectSseEvents(
      streamService.streamMessage(uid, thread.id, 'oui'),
    );

    expect(generateSpy).toHaveBeenCalledWith(uid, {
      type: 'flashcards',
      itemCount: 10,
      sourceChatId: thread.id,
      focusAreas: expect.arrayContaining([
        expect.objectContaining({
          id: expect.any(String),
          documentId: expect.any(String),
        }),
      ]),
    });

    const createdEvent = events.find(
      (event) => event.event === 'learning_session_created',
    );
    expect(createdEvent?.data).toMatchObject({
      type: 'flashcards',
      title: expect.stringContaining('Cartes ·'),
    });

    const doneEvent = events.find((event) => event.event === 'done');
    expect(doneEvent?.data.assistantMessage.content).toContain(
      'Tes cartes sont prêtes',
    );

    const loaded = await learningSessionsService.getById(
      uid,
      createdEvent!.data.sessionId,
    );
    expect(loaded.type).toBe('flashcards');
    expect(loaded.items).toHaveLength(10);
    expect(loaded.items[0]).toMatchObject({
      front: expect.any(String),
      back: expect.any(String),
    });
  });
});
