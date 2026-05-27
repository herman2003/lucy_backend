import { Test, TestingModule } from '@nestjs/testing';

import { FirebaseAuthGuard } from '../../core/auth/firebase-auth.guard';
import { FirebaseAuthService } from '../../core/auth/firebase-auth.service';
import { AppConfigModule, LUCY_CONFIG } from '../../core/config/app-config.module';
import { loadLucyConfig } from '../../core/config/lucy-config';
import { EMBEDDING_PORT } from '../../core/llm/embedding.tokens';
import { FakeEmbeddingAdapter } from '../../core/llm/fake.embedding.adapter';
import { LlmModule } from '../../core/llm/llm.module';
import { PromptLoaderService } from '../../core/prompt/prompt-loader.service';
import { PromptModule } from '../../core/prompt/prompt.module';
import { InMemoryUsersStore } from '../../core/persistence/in-memory-users.store';
import { LucyErrorCodes } from '../../core/errors/lucy-error-codes';
import { InMemoryDocumentChunksRepository } from '../documents/repositories/in-memory-document-chunks.repository';
import { InMemoryDocumentsRepository } from '../documents/repositories/in-memory-documents.repository';
import { DOCUMENT_CHUNKS_REPOSITORY } from '../documents/repositories/document-chunks.repository.port';
import { DOCUMENTS_REPOSITORY } from '../documents/repositories/documents.repository.port';
import { DOCUMENTS_STORAGE } from '../documents/storage/documents-storage.port';
import { InMemoryDocumentsStorage } from '../documents/storage/in-memory-documents.storage';
import { InMemoryOnboardingUsersRepository } from '../onboarding/repositories/in-memory-onboarding-user.repository';
import { RetrievalService } from '../retrieval/services/retrieval.service';
import { InMemoryUsersProfileRepository } from '../users/repositories/in-memory-users-profile.repository';
import { USERS_PROFILE_REPOSITORY } from '../users/repositories/users.repository.port';
import { ChatController } from './chat.controller';
import { InMemoryChatsRepository } from './repositories/in-memory-chats.repository';
import { CHATS_REPOSITORY } from './repositories/chats.repository.port';
import { ChatPrerequisitesService } from './services/chat-prerequisites.service';
import { ChatRagService } from './services/chat-rag.service';
import { ChatService } from './services/chat.service';
import { ChatActiveStreamRegistry } from './services/chat-active-stream.registry';
import { ChatStreamService } from './services/chat-stream.service';

describe('ChatController stream (CHAT-05/06)', () => {
  let controller: ChatController;
  let activeStreams: ChatActiveStreamRegistry;
  let onboardingRepo: InMemoryOnboardingUsersRepository;
  let documentsRepo: InMemoryDocumentsRepository;
  const uid = 'dev-user-chat-stream-controller';

  const validProfile = {
    primary_role: 'student' as const,
    main_domains: ['sciences' as const],
    learning_goal: 'exam' as const,
    self_assessed_level: 'intermediate' as const,
    explanation_style: 'step_by_step' as const,
    feedback_tone: 'encouraging' as const,
    tutoring_language: 'fr' as const,
  };

  beforeEach(async () => {
    const usersStore = new InMemoryUsersStore();
    onboardingRepo = new InMemoryOnboardingUsersRepository(usersStore);

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppConfigModule, LlmModule, PromptModule],
      controllers: [ChatController],
      providers: [
        ChatService,
        ChatStreamService,
        ChatRagService,
        ChatActiveStreamRegistry,
        ChatPrerequisitesService,
        RetrievalService,
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
        { provide: FirebaseAuthService, useValue: { verifyIdToken: jest.fn() } },
      ],
    })
      .overrideProvider(LUCY_CONFIG)
      .useValue(
        loadLucyConfig({
          NODE_ENV: 'test',
          LLM_PROVIDER: 'mock',
          FIREBASE_AUTH_MODE: 'dev',
          FIRESTORE_PROVIDER: 'memory',
        }),
      )
      .overrideGuard(FirebaseAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = moduleRef.get(ChatController);
    activeStreams = moduleRef.get(ChatActiveStreamRegistry);
    documentsRepo = moduleRef.get(InMemoryDocumentsRepository);
    moduleRef.get(PromptLoaderService).onModuleInit();
  });

  async function finalizeUserWithProfile(): Promise<void> {
    await onboardingRepo.saveAnalyzeSuccess(uid, validProfile, 'Résumé.');
    await onboardingRepo.finalizeOnboarding(uid);
  }

  function mockResponse(): {
    headers: Record<string, string>;
    chunks: string[];
    setHeader: (name: string, value: string) => void;
    write: (chunk: string) => void;
    end: () => void;
    flushHeaders: () => void;
  } {
    const headers: Record<string, string> = {};
    const chunks: string[] = [];
    return {
      headers,
      chunks,
      setHeader(name: string, value: string) {
        headers[name] = value;
      },
      write(chunk: string) {
        chunks.push(chunk);
      },
      end: () => undefined,
      flushHeaders: () => undefined,
    };
  }

  it('returns 409 JSON before SSE when no active documents', async () => {
    await finalizeUserWithProfile();
    const thread = await controller.createThread({ user: { uid } } as never, {});
    const response = mockResponse();

    await expect(
      controller.streamMessage(
        { user: { uid } } as never,
        thread.id,
        { content: 'Bonjour' },
        response as never,
      ),
    ).rejects.toMatchObject({
      error: LucyErrorCodes.CHAT_NO_ACTIVE_DOCUMENTS,
    });

    expect(response.chunks).toHaveLength(0);
  });

  it('writes SSE events when stream succeeds', async () => {
    await finalizeUserWithProfile();
    const doc = await documentsRepo.create(uid, {
      title: 'Doc',
      fileName: 'd.txt',
      mimeType: 'text/plain',
      byteSize: 1,
    });
    await documentsRepo.updateStatus(uid, doc.id, 'ready');
    await documentsRepo.setSearchEnabled(uid, doc.id, true);

    const thread = await controller.createThread({ user: { uid } } as never, {});
    const response = mockResponse();

    await controller.streamMessage(
      { user: { uid } } as never,
      thread.id,
      { content: 'Explique' },
      response as never,
    );

    expect(response.headers['Content-Type']).toBe('text/event-stream');
    const body = response.chunks.join('');
    expect(body).toContain('event: user_message');
    expect(body).toContain('event: text_delta');
    expect(body).toContain('event: sources');
    expect(body).toContain('event: done');
  });

  it('POST /messages returns JSON userMessage and assistantMessage', async () => {
    await finalizeUserWithProfile();
    const doc = await documentsRepo.create(uid, {
      title: 'Doc',
      fileName: 'd.txt',
      mimeType: 'text/plain',
      byteSize: 1,
    });
    await documentsRepo.updateStatus(uid, doc.id, 'ready');
    await documentsRepo.setSearchEnabled(uid, doc.id, true);

    const thread = await controller.createThread({ user: { uid } } as never, {});
    const result = await controller.sendMessage(
      { user: { uid } } as never,
      thread.id,
      { content: 'Via JSON' },
    );

    expect(result.userMessage.content).toBe('Via JSON');
    expect(result.assistantMessage.status).toBe('completed');
  });

  it('DELETE /chats/:id removes thread and messages', async () => {
    await finalizeUserWithProfile();
    const thread = await controller.createThread({ user: { uid } } as never, {});

    await controller.deleteThread({ user: { uid } } as never, thread.id);

    await expect(
      controller.listMessages({ user: { uid } } as never, thread.id, {}),
    ).rejects.toMatchObject({
      error: LucyErrorCodes.CHAT_NOT_FOUND,
    });
  });

  it('DELETE returns CHAT_STREAM_IN_PROGRESS when stream is active', async () => {
    await finalizeUserWithProfile();
    const thread = await controller.createThread({ user: { uid } } as never, {});
    activeStreams.acquire(uid, thread.id);

    await expect(
      controller.deleteThread({ user: { uid } } as never, thread.id),
    ).rejects.toMatchObject({
      error: LucyErrorCodes.CHAT_STREAM_IN_PROGRESS,
    });

    activeStreams.release(uid, thread.id);
  });
});
