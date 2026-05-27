import type { ChatSourceRecord } from './chat.types';

export type ChatSseEventName =
  | 'user_message'
  | 'text_delta'
  | 'sources'
  | 'done'
  | 'error';

export type ChatSseUserMessagePayload = {
  id: string;
  role: 'user';
  content: string;
  createdAt: string;
};

export type ChatSseTextDeltaPayload = {
  delta: string;
};

export type ChatSseSourcesPayload = {
  sources: ChatSourceRecord[];
};

export type ChatSseDonePayload = {
  userMessageId: string;
  assistantMessage: {
    id: string;
    role: 'assistant';
    content: string;
    createdAt: string;
    sources: ChatSourceRecord[];
    status: 'completed';
  };
};

export type ChatSseErrorPayload = {
  code: string;
  message: string;
};

export type ChatSseEvent =
  | { event: 'user_message'; data: ChatSseUserMessagePayload }
  | { event: 'text_delta'; data: ChatSseTextDeltaPayload }
  | { event: 'sources'; data: ChatSseSourcesPayload }
  | { event: 'done'; data: ChatSseDonePayload }
  | { event: 'error'; data: ChatSseErrorPayload };
