import { Test, TestingModule } from '@nestjs/testing';

import { FirebaseAuthGuard } from '../../core/auth/firebase-auth.guard';
import { FirebaseAuthService } from '../../core/auth/firebase-auth.service';
import { LucyErrorCodes } from '../../core/errors/lucy-error-codes';
import { LucyApiError } from '../../core/errors/lucy-api.error';
import { ChatController } from './chat.controller';
import { InMemoryChatsRepository } from './repositories/in-memory-chats.repository';
import { CHATS_REPOSITORY } from './repositories/chats.repository.port';
import { ChatService } from './services/chat.service';

describe('ChatController (CHAT-01)', () => {
  let controller: ChatController;
  let repository: InMemoryChatsRepository;
  const uidA = 'dev-user-chat-a';
  const uidB = 'dev-user-chat-b';

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [
        ChatService,
        InMemoryChatsRepository,
        { provide: CHATS_REPOSITORY, useExisting: InMemoryChatsRepository },
        {
          provide: FirebaseAuthService,
          useValue: { verifyIdToken: jest.fn() },
        },
      ],
    })
      .overrideGuard(FirebaseAuthGuard)
      .useValue({
        canActivate: () => true,
      })
      .compile();

    controller = moduleRef.get(ChatController);
    repository = moduleRef.get(InMemoryChatsRepository);
  });

  function asRequest(uid: string): { user: { uid: string } } {
    return { user: { uid } };
  }

  it('POST /chats creates a thread with default title', async () => {
    const created = await controller.createThread(asRequest(uidA) as never, {});

    expect(created.id).toEqual(expect.any(String));
    expect(created.title).toBe('New conversation');
    expect(created.createdAt).toEqual(expect.any(String));
    expect(created.updatedAt).toEqual(expect.any(String));
  });

  it('POST /chats accepts optional title', async () => {
    const created = await controller.createThread(asRequest(uidA) as never, {
      title: '  Thermodynamique  ',
    });

    expect(created.title).toBe('Thermodynamique');
  });

  it('GET /chats returns threads sorted by updatedAt desc', async () => {
    const first = await controller.createThread(asRequest(uidA) as never, {
      title: 'First',
    });
    await new Promise((r) => setTimeout(r, 5));
    const second = await controller.createThread(asRequest(uidA) as never, {
      title: 'Second',
    });

    await repository.appendMessage(uidA, first.id, {
      id: 'msg_bump',
      role: 'user',
      content: 'bump',
      createdAt: new Date().toISOString(),
    });

    const list = await controller.listThreads(asRequest(uidA) as never);

    expect(list.map((t) => t.id)).toEqual([first.id, second.id]);
    expect(list[0]?.lastMessagePreview).toBe('bump');
  });

  it('GET /chats/:chatId/messages returns messages in chronological order', async () => {
    const created = await controller.createThread(asRequest(uidA) as never, {});
    await repository.appendMessage(uidA, created.id, {
      id: 'msg_1',
      role: 'user',
      content: 'Question',
      createdAt: '2026-01-01T10:00:00.000Z',
    });
    await repository.appendMessage(uidA, created.id, {
      id: 'msg_2',
      role: 'assistant',
      content: 'Answer',
      createdAt: '2026-01-01T10:00:01.000Z',
      status: 'completed',
      sources: [],
    });

    const messages = await controller.listMessages(
      asRequest(uidA) as never,
      created.id,
      {},
    );

    expect(messages).toHaveLength(2);
    expect(messages[0]?.role).toBe('user');
    expect(messages[1]?.role).toBe('assistant');
    expect(messages[1]?.status).toBe('completed');
  });

  it('isolates chats by uid (user B cannot read user A thread)', async () => {
    const created = await controller.createThread(asRequest(uidA) as never, {
      title: 'Private',
    });

    await expect(
      controller.listMessages(asRequest(uidB) as never, created.id, {}),
    ).rejects.toMatchObject({
      statusCode: 404,
      error: LucyErrorCodes.CHAT_NOT_FOUND,
    } satisfies Partial<LucyApiError>);
  });

  it('returns CHAT_NOT_FOUND for unknown chatId', async () => {
    await expect(
      controller.listMessages(asRequest(uidA) as never, 'chat_missing', {}),
    ).rejects.toMatchObject({
      error: LucyErrorCodes.CHAT_NOT_FOUND,
    });
  });

  it('rejects invalid message list limit', async () => {
    const created = await controller.createThread(asRequest(uidA) as never, {});

    await expect(
      controller.listMessages(asRequest(uidA) as never, created.id, { limit: '200' }),
    ).rejects.toMatchObject({
      error: LucyErrorCodes.VALIDATION_ERROR,
    });
  });
});
