import { LucyErrorCodes } from '../../../core/errors/lucy-error-codes';
import { LucyApiError } from '../../../core/errors/lucy-api.error';
import type { LearningSessionType } from '../domain/learning-session.types';
import type { StudyFocusArea, StudyFocusImportance } from '../domain/study-focus-area.types';
import { LEARNING_SESSION_ITEM_LIMITS } from './learning-session.constants';

export type GenerateLearningSessionInput = {
  type: LearningSessionType;
  itemCount: number;
  sourceChatId?: string;
  topicHint?: string;
  examType?: string;
  focusAreas?: StudyFocusArea[];
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

  let topicHint: string | undefined;
  if ('topicHint' in record) {
    if (typeof record.topicHint !== 'string' || record.topicHint.trim().length === 0) {
      throw validationError('topicHint must be a non-empty string');
    }
    topicHint = record.topicHint.trim();
  }

  const focusAreas = parseOptionalFocusAreas(record.focusAreas);

  let examType: string | undefined;
  if ('examType' in record) {
    if (typeof record.examType !== 'string' || record.examType.trim().length === 0) {
      throw validationError('examType must be a non-empty string');
    }
    examType = record.examType.trim();
  }

  return {
    type,
    itemCount,
    ...(sourceChatId !== undefined ? { sourceChatId } : {}),
    ...(topicHint !== undefined ? { topicHint } : {}),
    ...(examType !== undefined ? { examType } : {}),
    ...(focusAreas !== undefined ? { focusAreas } : {}),
  };
}

function parseType(value: unknown): LearningSessionType {
  if (value === 'quiz' || value === 'flashcards') {
    return value;
  }
  throw validationError('type must be quiz or flashcards');
}

function parseOptionalFocusAreas(value: unknown): StudyFocusArea[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value) || value.length === 0) {
    throw validationError('focusAreas must be a non-empty array');
  }

  return value.map((raw, index) => parseFocusArea(raw, index));
}

function parseFocusArea(value: unknown, index: number): StudyFocusArea {
  if (!value || typeof value !== 'object') {
    throw validationError(`focusAreas[${index}] must be an object`);
  }

  const record = value as Record<string, unknown>;
  const documentId = readNonEmptyString(record.documentId, `focusAreas[${index}].documentId`);
  const documentTitle = readNonEmptyString(
    record.documentTitle,
    `focusAreas[${index}].documentTitle`,
  );
  const label = readNonEmptyString(record.label, `focusAreas[${index}].label`);
  const rationale = readNonEmptyString(
    record.rationale,
    `focusAreas[${index}].rationale`,
  );
  const ordinalStart = readOrdinal(record.ordinalStart, `focusAreas[${index}].ordinalStart`);
  const ordinalEnd = readOrdinal(record.ordinalEnd, `focusAreas[${index}].ordinalEnd`);
  if (ordinalEnd < ordinalStart) {
    throw validationError(`focusAreas[${index}].ordinalEnd must be >= ordinalStart`);
  }

  const importance = parseImportance(record.importance, index);
  const keyConcepts = parseKeyConcepts(record.keyConcepts, index);
  const id =
    typeof record.id === 'string' && record.id.trim().length > 0
      ? record.id.trim()
      : `focus_${index + 1}`;

  const pageStart = readOptionalPage(record.pageStart, `focusAreas[${index}].pageStart`);
  const pageEnd = readOptionalPage(record.pageEnd, `focusAreas[${index}].pageEnd`);

  return {
    id,
    documentId,
    documentTitle,
    label,
    ordinalStart,
    ordinalEnd,
    importance,
    rationale,
    keyConcepts,
    ...(pageStart !== undefined ? { pageStart } : {}),
    ...(pageEnd !== undefined ? { pageEnd } : {}),
  };
}

function readNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw validationError(`${field} must be a non-empty string`);
  }
  return value.trim();
}

function readOrdinal(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw validationError(`${field} must be a non-negative integer`);
  }
  return value;
}

function readOptionalPage(value: unknown, field: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw validationError(`${field} must be a positive integer`);
  }
  return value;
}

function parseImportance(value: unknown, index: number): StudyFocusImportance {
  if (value === 'high' || value === 'medium') {
    return value;
  }
  throw validationError(`focusAreas[${index}].importance must be high or medium`);
}

function parseKeyConcepts(value: unknown, index: number): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw validationError(`focusAreas[${index}].keyConcepts must be a non-empty array`);
  }
  return value.map((concept, conceptIndex) =>
    readNonEmptyString(
      concept,
      `focusAreas[${index}].keyConcepts[${conceptIndex}]`,
    ),
  );
}

function validationError(message: string): LucyApiError {
  return new LucyApiError(400, LucyErrorCodes.LEARNING_VALIDATION_ERROR, message);
}
