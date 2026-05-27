export const CHAT_STREAM_MESSAGE_MIN_LENGTH = 1;
export const CHAT_STREAM_MESSAGE_MAX_LENGTH = 4000;
export const CHAT_HISTORY_PROMPT_MAX_MESSAGES = 100;
export const CHAT_RETRIEVAL_LIMIT = 5;
export const CHAT_SOURCE_EXCERPT_MAX_LENGTH = 300;
export const CHAT_AUTO_TITLE_MAX_LENGTH = 60;
export const CHAT_SSE_PING_INTERVAL_MS = 15_000;

export const CHAT_CITATION_JSON_SCHEMA = {
  type: 'object',
  properties: {
    citedChunkIds: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['citedChunkIds'],
} as const;
