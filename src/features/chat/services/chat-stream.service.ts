import { Inject, Injectable } from '@nestjs/common';

import { LLM_STREAMING_PORT } from '../../../core/llm/llm-streaming.tokens';
import type { LlmStreamingPort } from '../../../core/llm/llm-streaming.port';
import { LucyErrorCodes } from '../../../core/errors/lucy-error-codes';
import { LucyApiError } from '../../../core/errors/lucy-api.error';
import type { LearnerProfile } from '../../onboarding/domain/learner-profile.enums';
import { RetrievalService } from '../../retrieval/services/retrieval.service';
import {
  CHAT_AUTO_TITLE_MAX_LENGTH,
  CHAT_RETRIEVAL_LIMIT,
} from '../chat.constants';
import { buildOffCorpusAssistantReply } from '../utils/chat-off-corpus-reply';
import {
  filterRetrievalHitsForChat,
  isOffCorpusForChat,
} from '../utils/chat-retrieval-filter';
import { DEFAULT_CHAT_TITLE } from '../dto/create-chat.dto';
import type { SendChatMessageResponseDto } from '../dto/send-chat-message-response.dto';
import type { ChatSseEvent } from '../domain/chat-sse.types';
import type {
  ChatSourceRecord,
  PersistedChatMessage,
  PersistedChatThread,
} from '../domain/chat.types';
import {
  CHATS_REPOSITORY,
  type ChatsRepository,
} from '../repositories/chats.repository.port';
import { ChatActiveStreamRegistry } from './chat-active-stream.registry';
import { ChatPrerequisitesService } from './chat-prerequisites.service';
import { ChatRagService } from './chat-rag.service';
import type { ChatMessageDto } from './chat.service';

type TurnContext = {
  thread: PersistedChatThread;
  learnerProfile: LearnerProfile;
  historyBefore: PersistedChatMessage[];
  isFirstUserTurn: boolean;
  userMessage: PersistedChatMessage;
};

type CompleteTurnOptions = {
  onTextDelta?: (delta: string) => void;
};

type CompleteTurnResult = {
  assistantMessage: PersistedChatMessage;
  sources: ChatSourceRecord[];
};

@Injectable()
export class ChatStreamService {
  constructor(
    @Inject(CHATS_REPOSITORY)
    private readonly chatsRepository: ChatsRepository,
    private readonly chatPrerequisites: ChatPrerequisitesService,
    private readonly retrievalService: RetrievalService,
    private readonly chatRag: ChatRagService,
    private readonly activeStreams: ChatActiveStreamRegistry,
    @Inject(LLM_STREAMING_PORT)
    private readonly llmStreaming: LlmStreamingPort,
  ) {}

  /** Guards that must run before opening the SSE response (JSON errors). */
  async assertCanStream(uid: string, chatId: string): Promise<void> {
    await this.requireThread(uid, chatId);
    this.activeStreams.assertNotActive(uid, chatId);
    await this.chatPrerequisites.requireLearnerProfile(uid);
    await this.chatPrerequisites.requireActiveDocuments(uid);
  }

  async sendMessage(
    uid: string,
    chatId: string,
    content: string,
  ): Promise<SendChatMessageResponseDto> {
    await this.assertCanStream(uid, chatId);
    this.activeStreams.acquire(uid, chatId);
    try {
      const turn = await this.beginTurn(uid, chatId, content);
      const { assistantMessage } = await this.completeTurn(uid, chatId, content, turn);
      return {
        userMessage: toMessageDto(turn.userMessage),
        assistantMessage: toMessageDto(assistantMessage),
      };
    } finally {
      this.activeStreams.release(uid, chatId);
    }
  }

  async *streamMessage(
    uid: string,
    chatId: string,
    content: string,
  ): AsyncGenerator<ChatSseEvent> {
    this.activeStreams.acquire(uid, chatId);
    try {
      const turn = await this.beginTurn(uid, chatId, content);

      yield {
        event: 'user_message',
        data: {
          id: turn.userMessage.id,
          role: 'user',
          content: turn.userMessage.content,
          createdAt: turn.userMessage.createdAt,
        },
      };

      const deltas: string[] = [];
      const { assistantMessage, sources } = await this.completeTurn(
        uid,
        chatId,
        content,
        turn,
        {
          onTextDelta: (delta) => {
            deltas.push(delta);
          },
        },
      );

      for (const delta of deltas) {
        yield { event: 'text_delta', data: { delta } };
      }

      yield { event: 'sources', data: { sources } };
      yield {
        event: 'done',
        data: {
          userMessageId: turn.userMessage.id,
          assistantMessage: {
            id: assistantMessage.id,
            role: 'assistant',
            content: assistantMessage.content,
            createdAt: assistantMessage.createdAt,
            sources,
            status: 'completed',
          },
        },
      };
    } catch (error) {
      const apiError = toStreamError(error);
      yield {
        event: 'error',
        data: {
          code: apiError.error,
          message: apiError.message,
        },
      };
    } finally {
      this.activeStreams.release(uid, chatId);
    }
  }

  private async beginTurn(
    uid: string,
    chatId: string,
    content: string,
  ): Promise<TurnContext> {
    const thread = await this.requireThread(uid, chatId);
    const learnerProfile = await this.chatPrerequisites.requireLearnerProfile(uid);
    await this.chatPrerequisites.requireActiveDocuments(uid);

    const historyBefore = await this.chatsRepository.listMessages(uid, chatId, {
      limit: 100,
    });
    const isFirstUserTurn = !historyBefore.some((message) => message.role === 'user');

    const userMessage = await this.chatsRepository.appendMessage(uid, chatId, {
      id: newMessageId(),
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    });

    return { thread, learnerProfile, historyBefore, isFirstUserTurn, userMessage };
  }

  private async completeTurn(
    uid: string,
    chatId: string,
    content: string,
    turn: TurnContext,
    options: CompleteTurnOptions = {},
  ): Promise<CompleteTurnResult> {
    const rawHits = await this.retrievalService.search(uid, {
      query: content,
      limit: CHAT_RETRIEVAL_LIMIT,
    });
    const hits = filterRetrievalHitsForChat(rawHits);

    let assistantText = '';
    let sources: ChatSourceRecord[] = [];

    if (isOffCorpusForChat(hits)) {
      assistantText = buildOffCorpusAssistantReply(turn.learnerProfile.tutoring_language);
      options.onTextDelta?.(assistantText);
    } else {
      const systemPrompt = this.chatRag.buildSystemPrompt(turn.learnerProfile);
      const userPrompt = this.chatRag.buildUserPrompt(turn.historyBefore, content, hits);

      for await (const delta of this.llmStreaming.streamText({ systemPrompt, userPrompt })) {
        assistantText += delta;
        options.onTextDelta?.(delta);
      }

      sources = await this.chatRag.resolveSourcesSafely(assistantText, hits);
    }

    const assistantMessage = await this.chatsRepository.appendMessage(uid, chatId, {
      id: newMessageId(),
      role: 'assistant',
      content: assistantText,
      createdAt: new Date().toISOString(),
      status: 'completed',
      sources,
    });

    if (turn.isFirstUserTurn && turn.thread.title === DEFAULT_CHAT_TITLE) {
      await this.chatsRepository.patchThread(uid, chatId, {
        title: buildAutoTitle(content),
      });
    }

    return { assistantMessage, sources };
  }

  private async requireThread(uid: string, chatId: string): Promise<PersistedChatThread> {
    const thread = await this.chatsRepository.getThread(uid, chatId);
    if (!thread) {
      throw new LucyApiError(404, LucyErrorCodes.CHAT_NOT_FOUND, 'Chat not found');
    }
    return thread;
  }
}

export function buildAutoTitle(firstUserMessage: string): string {
  const trimmed = firstUserMessage.trim();
  if (trimmed.length <= CHAT_AUTO_TITLE_MAX_LENGTH) {
    return trimmed;
  }
  return `${trimmed.slice(0, CHAT_AUTO_TITLE_MAX_LENGTH - 1)}…`;
}

function toMessageDto(message: PersistedChatMessage): ChatMessageDto {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt,
    ...(message.status !== undefined ? { status: message.status } : {}),
    ...(message.sources !== undefined ? { sources: message.sources } : {}),
  };
}

function newMessageId(): string {
  return `msg_${Date.now().toString(16)}_${Math.random().toString(16).slice(2, 10)}`;
}

function toStreamError(error: unknown): LucyApiError {
  if (error instanceof LucyApiError) {
    return error;
  }
  return new LucyApiError(
    503,
    LucyErrorCodes.LLM_UNAVAILABLE,
    error instanceof Error ? error.message : 'Stream failed',
  );
}
