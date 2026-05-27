import { Inject, Injectable } from '@nestjs/common';

import { LLM_STREAMING_PORT } from '../../../core/llm/llm-streaming.tokens';
import type { LlmStreamingPort } from '../../../core/llm/llm-streaming.port';
import { LucyErrorCodes } from '../../../core/errors/lucy-error-codes';
import { LucyApiError } from '../../../core/errors/lucy-api.error';
import { RetrievalService } from '../../retrieval/services/retrieval.service';
import { CHAT_AUTO_TITLE_MAX_LENGTH, CHAT_RETRIEVAL_LIMIT } from '../chat.constants';
import { DEFAULT_CHAT_TITLE } from '../dto/create-chat.dto';
import type { ChatSseEvent } from '../domain/chat-sse.types';
import type { PersistedChatThread } from '../domain/chat.types';
import {
  CHATS_REPOSITORY,
  type ChatsRepository,
} from '../repositories/chats.repository.port';
import { ChatPrerequisitesService } from './chat-prerequisites.service';
import { ChatRagService } from './chat-rag.service';

@Injectable()
export class ChatStreamService {
  constructor(
    @Inject(CHATS_REPOSITORY)
    private readonly chatsRepository: ChatsRepository,
    private readonly chatPrerequisites: ChatPrerequisitesService,
    private readonly retrievalService: RetrievalService,
    private readonly chatRag: ChatRagService,
    @Inject(LLM_STREAMING_PORT)
    private readonly llmStreaming: LlmStreamingPort,
  ) {}

  /** Guards that must run before opening the SSE response (JSON errors). */
  async assertCanStream(uid: string, chatId: string): Promise<void> {
    await this.requireThread(uid, chatId);
    await this.chatPrerequisites.requireLearnerProfile(uid);
    await this.chatPrerequisites.requireActiveDocuments(uid);
  }

  async *streamMessage(
    uid: string,
    chatId: string,
    content: string,
  ): AsyncGenerator<ChatSseEvent> {
    try {
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

      yield {
        event: 'user_message',
        data: {
          id: userMessage.id,
          role: 'user',
          content: userMessage.content,
          createdAt: userMessage.createdAt,
        },
      };

      const hits = await this.retrievalService.search(uid, {
        query: content,
        limit: CHAT_RETRIEVAL_LIMIT,
      });

      const systemPrompt = this.chatRag.buildSystemPrompt(learnerProfile);
      const userPrompt = this.chatRag.buildUserPrompt(historyBefore, content, hits);

      let assistantText = '';
      for await (const delta of this.llmStreaming.streamText({
        systemPrompt,
        userPrompt,
      })) {
        assistantText += delta;
        yield { event: 'text_delta', data: { delta } };
      }

      const sources = await this.chatRag.resolveSources(assistantText, hits);
      yield { event: 'sources', data: { sources } };

      const assistantMessage = await this.chatsRepository.appendMessage(uid, chatId, {
        id: newMessageId(),
        role: 'assistant',
        content: assistantText,
        createdAt: new Date().toISOString(),
        status: 'completed',
        sources,
      });

      if (isFirstUserTurn && thread.title === DEFAULT_CHAT_TITLE) {
        await this.chatsRepository.patchThread(uid, chatId, {
          title: buildAutoTitle(content),
        });
      }

      yield {
        event: 'done',
        data: {
          userMessageId: userMessage.id,
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
    }
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
