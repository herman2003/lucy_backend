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
