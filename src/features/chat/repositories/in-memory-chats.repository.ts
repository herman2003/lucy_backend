import { Injectable } from '@nestjs/common';

import type { PersistedChatMessage, PersistedChatThread } from '../domain/chat.types';
import type { PendingLearningGeneration } from '../domain/pending-learning-generation.types';
import type { CorpusStudyPlan } from '../../learning-sessions/domain/study-focus-area.types';
import type {
  ChatsRepository,
  ListChatMessagesOptions,
} from './chats.repository.port';

@Injectable()
export class InMemoryChatsRepository implements ChatsRepository {
  private readonly threadsByUid = new Map<string, PersistedChatThread[]>();
  private readonly messagesByUid = new Map<string, Map<string, PersistedChatMessage[]>>();

  async createThread(uid: string, title: string): Promise<PersistedChatThread> {
    const now = new Date().toISOString();
    const thread: PersistedChatThread = {
      id: this.newId(),
      uid,
      title,
      createdAt: now,
      updatedAt: now,
    };
    const list = this.threadsByUid.get(uid) ?? [];
    list.push(thread);
    this.threadsByUid.set(uid, list);
    this.messagesByUid.set(uid, this.messagesByUid.get(uid) ?? new Map());
    return thread;
  }

  async listThreads(uid: string): Promise<PersistedChatThread[]> {
    const list = [...(this.threadsByUid.get(uid) ?? [])];
    list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return list;
  }

  async getThread(uid: string, chatId: string): Promise<PersistedChatThread | null> {
    return this.findThread(uid, chatId) ?? null;
  }

  async listMessages(
    uid: string,
    chatId: string,
    options: ListChatMessagesOptions,
  ): Promise<PersistedChatMessage[]> {
    const thread = this.findThread(uid, chatId);
    if (!thread) {
      return [];
    }

    let messages = [...(this.messagesByUid.get(uid)?.get(chatId) ?? [])];
    messages.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    if (options.beforeMessageId !== undefined) {
      const index = messages.findIndex((m) => m.id === options.beforeMessageId);
      if (index <= 0) {
        messages = [];
      } else {
        messages = messages.slice(0, index);
      }
    }

    if (messages.length > options.limit) {
      messages = messages.slice(messages.length - options.limit);
    }

    return messages;
  }

  async appendMessage(
    uid: string,
    chatId: string,
    message: Omit<PersistedChatMessage, 'chatId'>,
  ): Promise<PersistedChatMessage> {
    const thread = this.findThread(uid, chatId);
    if (!thread) {
      throw new Error(`Chat thread not found: ${chatId}`);
    }

    const stored: PersistedChatMessage = { ...message, chatId };
    const byChat = this.messagesByUid.get(uid) ?? new Map();
    const list = byChat.get(chatId) ?? [];
    list.push(stored);
    byChat.set(chatId, list);
    this.messagesByUid.set(uid, byChat);

    thread.updatedAt = stored.createdAt;
    thread.lastMessagePreview = stored.content.slice(0, 120);

    return stored;
  }

  async patchThread(
    uid: string,
    chatId: string,
    patch: {
      title?: string;
      pendingLearningGeneration?: PendingLearningGeneration | null;
      corpusStudyPlan?: CorpusStudyPlan | null;
    },
  ): Promise<void> {
    const thread = this.findThread(uid, chatId);
    if (!thread) {
      throw new Error(`Chat thread not found: ${chatId}`);
    }
    if (patch.title !== undefined) {
      thread.title = patch.title;
    }
    if (patch.pendingLearningGeneration !== undefined) {
      if (patch.pendingLearningGeneration === null) {
        delete thread.pendingLearningGeneration;
      } else {
        thread.pendingLearningGeneration = patch.pendingLearningGeneration;
      }
    }
    if (patch.corpusStudyPlan !== undefined) {
      if (patch.corpusStudyPlan === null) {
        delete thread.corpusStudyPlan;
      } else {
        thread.corpusStudyPlan = patch.corpusStudyPlan;
      }
    }
    thread.updatedAt = new Date().toISOString();
  }

  async deleteThread(uid: string, chatId: string): Promise<void> {
    const threads = this.threadsByUid.get(uid) ?? [];
    const index = threads.findIndex((thread) => thread.id === chatId);
    if (index < 0) {
      throw new Error(`Chat thread not found: ${chatId}`);
    }
    threads.splice(index, 1);
    this.threadsByUid.set(uid, threads);
    this.messagesByUid.get(uid)?.delete(chatId);
  }

  private findThread(uid: string, chatId: string): PersistedChatThread | undefined {
    return (this.threadsByUid.get(uid) ?? []).find((t) => t.id === chatId);
  }

  private newId(): string {
    return `chat_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
  }
}
