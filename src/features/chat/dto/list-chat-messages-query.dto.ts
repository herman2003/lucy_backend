import { LucyErrorCodes } from '../../../core/errors/lucy-error-codes';
import { LucyApiError } from '../../../core/errors/lucy-api.error';

export const DEFAULT_CHAT_MESSAGES_LIMIT = 100;
export const MAX_CHAT_MESSAGES_LIMIT = 100;

export type ListChatMessagesQueryDto = {
  limit: number;
  beforeMessageId?: string;
};

export function parseListChatMessagesQuery(
  query: Record<string, unknown>,
): ListChatMessagesQueryDto {
  let limit = DEFAULT_CHAT_MESSAGES_LIMIT;

  if (query.limit !== undefined) {
    const raw = query.limit;
    const parsed =
      typeof raw === 'string' ? Number.parseInt(raw, 10) : typeof raw === 'number' ? raw : NaN;
    if (!Number.isInteger(parsed)) {
      throw validationError('limit must be an integer');
    }
    if (parsed < 1 || parsed > MAX_CHAT_MESSAGES_LIMIT) {
      throw validationError(`limit must be between 1 and ${MAX_CHAT_MESSAGES_LIMIT}`);
    }
    limit = parsed;
  }

  let beforeMessageId: string | undefined;
  if (query.before !== undefined) {
    if (typeof query.before !== 'string' || query.before.trim().length === 0) {
      throw validationError('before must be a non-empty message id');
    }
    beforeMessageId = query.before.trim();
  }

  return {
    limit,
    ...(beforeMessageId !== undefined ? { beforeMessageId } : {}),
  };
}

function validationError(message: string): LucyApiError {
  return new LucyApiError(400, LucyErrorCodes.VALIDATION_ERROR, message);
}
