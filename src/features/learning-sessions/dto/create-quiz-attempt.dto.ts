import { LucyErrorCodes } from '../../../core/errors/lucy-error-codes';
import { LucyApiError } from '../../../core/errors/lucy-api.error';
import type {
  CreateQuizAttemptInput,
  QuizAttemptAnswer,
} from '../domain/quiz-attempt.types';

export function parseCreateQuizAttemptRequest(
  body: unknown,
): CreateQuizAttemptInput {
  if (!body || typeof body !== 'object') {
    throw validationError('Body must be an object');
  }

  const record = body as Record<string, unknown>;

  const id = parseNonEmptyString(record.id, 'id');
  const startedAt = parseIsoDate(record.startedAt, 'startedAt');
  const completedAt = parseIsoDate(record.completedAt, 'completedAt');
  const scoreCorrect = parseNonNegativeInt(record.scoreCorrect, 'scoreCorrect');
  const scoreTotal = parsePositiveInt(record.scoreTotal, 'scoreTotal');
  const answers = parseAnswers(record.answers);

  return {
    id,
    startedAt,
    completedAt,
    scoreCorrect,
    scoreTotal,
    answers,
  };
}

function parseAnswers(value: unknown): QuizAttemptAnswer[] {
  if (!Array.isArray(value)) {
    throw validationError('answers must be an array');
  }

  return value.map((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      throw validationError(`answers[${index}] must be an object`);
    }
    const record = entry as Record<string, unknown>;
    return {
      itemId: parseNonEmptyString(record.itemId, `answers[${index}].itemId`),
      selectedIndex: parseNonNegativeInt(
        record.selectedIndex,
        `answers[${index}].selectedIndex`,
      ),
      correctIndex: parseNonNegativeInt(
        record.correctIndex,
        `answers[${index}].correctIndex`,
      ),
      isCorrect: parseBoolean(record.isCorrect, `answers[${index}].isCorrect`),
    };
  });
}

function parseNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw validationError(`${field} must be a non-empty string`);
  }
  return value.trim();
}

function parseIsoDate(value: unknown, field: string): string {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw validationError(`${field} must be a valid ISO date string`);
  }
  return new Date(value).toISOString();
}

function parseNonNegativeInt(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw validationError(`${field} must be a non-negative integer`);
  }
  return value;
}

function parsePositiveInt(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw validationError(`${field} must be a positive integer`);
  }
  return value;
}

function parseBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') {
    throw validationError(`${field} must be a boolean`);
  }
  return value;
}

function validationError(message: string): LucyApiError {
  return new LucyApiError(
    400,
    LucyErrorCodes.LEARNING_VALIDATION_ERROR,
    message,
  );
}
