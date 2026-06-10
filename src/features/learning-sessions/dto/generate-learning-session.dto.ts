import { LucyErrorCodes } from '../../../core/errors/lucy-error-codes';
import { LucyApiError } from '../../../core/errors/lucy-api.error';
import type { LearningSessionType } from '../domain/learning-session.types';
import { LEARNING_SESSION_ITEM_LIMITS } from './learning-session.constants';

export type GenerateLearningSessionInput = {
  type: LearningSessionType;
  itemCount: number;
  sourceChatId?: string;
};

export function parseGenerateLearningSessionRequest(
  body: unknown,
): GenerateLearningSessionInput {
  if (!body || typeof body !== 'object') {
    throw validationError('Body must be an object');
  }

  const record = body as Record<string, unknown>;
  const type = parseType(record.type);
  const limits = LEARNING_SESSION_ITEM_LIMITS[type];

  let itemCount = limits.defaultCount;
  if ('itemCount' in record) {
    if (
      typeof record.itemCount !== 'number' ||
      !Number.isInteger(record.itemCount) ||
      record.itemCount < 1 ||
      record.itemCount > limits.maxCount
    ) {
      throw validationError(
        `itemCount must be an integer between 1 and ${limits.maxCount}`,
      );
    }
    itemCount = record.itemCount;
  }

  let sourceChatId: string | undefined;
  if ('sourceChatId' in record) {
    if (
      typeof record.sourceChatId !== 'string' ||
      record.sourceChatId.trim().length === 0
    ) {
      throw validationError('sourceChatId must be a non-empty string');
    }
    sourceChatId = record.sourceChatId.trim();
  }

  return {
    type,
    itemCount,
    ...(sourceChatId !== undefined ? { sourceChatId } : {}),
  };
}

function parseType(value: unknown): LearningSessionType {
  if (value === 'quiz' || value === 'flashcards') {
    return value;
  }
  throw validationError('type must be quiz or flashcards');
}

function validationError(message: string): LucyApiError {
  return new LucyApiError(400, LucyErrorCodes.LEARNING_VALIDATION_ERROR, message);
}
