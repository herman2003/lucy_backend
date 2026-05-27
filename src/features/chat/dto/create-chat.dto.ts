import { LucyErrorCodes } from '../../../core/errors/lucy-error-codes';
import { LucyApiError } from '../../../core/errors/lucy-api.error';

export type CreateChatRequestDto = {
  title?: string;
};

export const DEFAULT_CHAT_TITLE = 'New conversation';
export const MAX_CHAT_TITLE_LENGTH = 120;

export function parseCreateChatRequest(body: unknown): CreateChatRequestDto {
  if (body === undefined || body === null) {
    return {};
  }
  if (typeof body !== 'object') {
    throw validationError('Request body must be an object');
  }

  const record = body as Record<string, unknown>;
  if (record.title === undefined) {
    return {};
  }
  if (typeof record.title !== 'string') {
    throw validationError('title must be a string');
  }
  const title = record.title.trim();
  if (title.length === 0) {
    throw validationError('title must not be empty');
  }
  if (title.length > MAX_CHAT_TITLE_LENGTH) {
    throw validationError(`title must be at most ${MAX_CHAT_TITLE_LENGTH} characters`);
  }
  return { title };
}

function validationError(message: string): LucyApiError {
  return new LucyApiError(400, LucyErrorCodes.VALIDATION_ERROR, message);
}
