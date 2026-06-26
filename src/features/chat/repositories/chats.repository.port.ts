import type { CorpusStudyPlan } from '../../learning-sessions/domain/study-focus-area.types';
import type {
  PersistedChatMessage,
  PersistedChatThread,
} from '../domain/chat.types';
import type { PendingLearningGeneration } from '../domain/pending-learning-generation.types';

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

  patchThread(
    uid: string,
    chatId: string,
    patch: {
      title?: string;
      pendingLearningGeneration?: PendingLearningGeneration | null;
      corpusStudyPlan?: CorpusStudyPlan | null;
    },
  ): Promise<void>;

  deleteThread(uid: string, chatId: string): Promise<void>;
}
