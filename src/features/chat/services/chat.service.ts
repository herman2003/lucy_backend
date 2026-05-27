import { Inject, Injectable } from '@nestjs/common';

import { LucyErrorCodes } from '../../../core/errors/lucy-error-codes';
import { LucyApiError } from '../../../core/errors/lucy-api.error';
import {
  DEFAULT_CHAT_TITLE,
  type CreateChatRequestDto,
} from '../dto/create-chat.dto';
import type { ListChatMessagesQueryDto } from '../dto/list-chat-messages-query.dto';
import type { PersistedChatMessage, PersistedChatThread } from '../domain/chat.types';
import {
  CHATS_REPOSITORY,
  type ChatsRepository,
} from '../repositories/chats.repository.port';

export type ChatThreadListItemDto = {
  id: string;
  title: string;
  updatedAt: string;
  lastMessagePreview?: string;
};

export type ChatThreadCreatedDto = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type ChatMessageDto = {
  id: string;
  role: PersistedChatMessage['role'];
  content: string;
  createdAt: string;
  status?: PersistedChatMessage['status'];
  sources?: PersistedChatMessage['sources'];
};

@Injectable()
export class ChatService {
  constructor(
    @Inject(CHATS_REPOSITORY)
    private readonly chatsRepository: ChatsRepository,
  ) {}

  async listThreads(uid: string): Promise<ChatThreadListItemDto[]> {
    const threads = await this.chatsRepository.listThreads(uid);
    return threads.map((thread) => this.toThreadListItem(thread));
  }

  async createThread(uid: string, input: CreateChatRequestDto): Promise<ChatThreadCreatedDto> {
    const title = input.title ?? DEFAULT_CHAT_TITLE;
    const thread = await this.chatsRepository.createThread(uid, title);
    return {
      id: thread.id,
      title: thread.title,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
    };
  }

  async listMessages(
    uid: string,
    chatId: string,
    query: ListChatMessagesQueryDto,
  ): Promise<ChatMessageDto[]> {
    await this.requireThread(uid, chatId);
    const messages = await this.chatsRepository.listMessages(uid, chatId, {
      limit: query.limit,
      ...(query.beforeMessageId !== undefined
        ? { beforeMessageId: query.beforeMessageId }
        : {}),
    });
    return messages.map((message) => this.toMessageDto(message));
  }

  private async requireThread(uid: string, chatId: string): Promise<PersistedChatThread> {
    const thread = await this.chatsRepository.getThread(uid, chatId);
    if (!thread) {
      throw new LucyApiError(404, LucyErrorCodes.CHAT_NOT_FOUND, 'Chat not found');
    }
    return thread;
  }

  private toThreadListItem(thread: PersistedChatThread): ChatThreadListItemDto {
    return {
      id: thread.id,
      title: thread.title,
      updatedAt: thread.updatedAt,
      ...(thread.lastMessagePreview !== undefined
        ? { lastMessagePreview: thread.lastMessagePreview }
        : {}),
    };
  }

  private toMessageDto(message: PersistedChatMessage): ChatMessageDto {
    return {
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt,
      ...(message.status !== undefined ? { status: message.status } : {}),
      ...(message.sources !== undefined ? { sources: message.sources } : {}),
    };
  }
}
