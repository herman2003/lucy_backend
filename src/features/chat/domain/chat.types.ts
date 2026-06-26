import type { CorpusStudyPlan } from '../../learning-sessions/domain/study-focus-area.types';
import type { PendingLearningGeneration } from './pending-learning-generation.types';

export type ChatMessageRole = 'user' | 'assistant';

export type ChatMessageStatus = 'completed' | 'failed';

export type ChatSourceRecord = {
  documentId: string;
  title: string;
  chunkId: string;
  excerpt: string;
  pageStart?: number;
  pageEnd?: number;
  score?: number;
};

export type PersistedChatThread = {
  id: string;
  uid: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastMessagePreview?: string;
  pendingLearningGeneration?: PendingLearningGeneration;
  corpusStudyPlan?: CorpusStudyPlan;
};

export type PersistedChatMessage = {
  id: string;
  chatId: string;
  role: ChatMessageRole;
  content: string;
  createdAt: string;
  status?: ChatMessageStatus;
  sources?: ChatSourceRecord[];
};
