import type {
  PersistedChatMessage,
  PersistedChatThread,
} from '../domain/chat.types';

export const CHATS_REPOSITORY = Symbol('CHATS_REPOSITORY');

export type ListChatMessagesOptions = {
  limit: number;
  beforeMessageId?: string;
};

export interface ChatsRepository {
  createThread(uid: string, title: string): Promise<PersistedChatThread>;

  listThreads(uid: string): Promise<PersistedChatThread[]>;

  getThread(uid: string, chatId: string): Promise<PersistedChatThread | null>;

  listMessages(
    uid: string,
    chatId: string,
    options: ListChatMessagesOptions,
  ): Promise<PersistedChatMessage[]>;

  appendMessage(
    uid: string,
    chatId: string,
    message: Omit<PersistedChatMessage, 'chatId'>,
  ): Promise<PersistedChatMessage>;
}
