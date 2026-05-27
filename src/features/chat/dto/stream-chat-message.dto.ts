import { LucyErrorCodes } from '../../../core/errors/lucy-error-codes';
import { LucyApiError } from '../../../core/errors/lucy-api.error';
import {
  CHAT_STREAM_MESSAGE_MAX_LENGTH,
  CHAT_STREAM_MESSAGE_MIN_LENGTH,
} from '../chat.constants';

export type StreamChatMessageRequestDto = {
  content: string;
};

export function parseStreamChatMessageRequest(body: unknown): StreamChatMessageRequestDto {
  if (!body || typeof body !== 'object') {
    throw validationError('Request body must be an object');
  }

  const record = body as Record<string, unknown>;
  const content = record.content;
  if (typeof content !== 'string') {
    throw validationError('content is required');
  }

  const trimmed = content.trim();
  if (trimmed.length < CHAT_STREAM_MESSAGE_MIN_LENGTH) {
    throw validationError('content must not be empty');
  }
  if (trimmed.length > CHAT_STREAM_MESSAGE_MAX_LENGTH) {
    throw validationError(
      `content must be at most ${CHAT_STREAM_MESSAGE_MAX_LENGTH} characters`,
    );
  }

  return { content: trimmed };
}

function validationError(message: string): LucyApiError {
  return new LucyApiError(400, LucyErrorCodes.VALIDATION_ERROR, message);
}
