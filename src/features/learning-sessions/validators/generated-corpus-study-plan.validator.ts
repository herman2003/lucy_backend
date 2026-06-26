import { learningGenerationFailed } from '../utils/learning-generation-failure.error';
import type {
  StudyFocusArea,
  StudyFocusImportance,
} from '../domain/study-focus-area.types';

export type CorpusStudyPlanValidationContext = {
  documentsById: Map<string, { title: string }>;
  ordinalsByDocumentId: Map<string, Set<number>>;
};

export function parseGeneratedCorpusStudyPlan(
  parsed: unknown,
  context: CorpusStudyPlanValidationContext,
): StudyFocusArea[] {
  if (!parsed || typeof parsed !== 'object') {
    throw analysisFailed('response must be an object');
  }

  const record = parsed as Record<string, unknown>;
  if (!Array.isArray(record.focusAreas)) {
    throw analysisFailed('focusAreas must be an array');
  }

  if (record.focusAreas.length < 1 || record.focusAreas.length > 8) {
    throw analysisFailed('focusAreas must contain between 1 and 8 items');
  }

  return record.focusAreas.map((raw, index) =>
    parseFocusArea(raw, index, context),
  );
}

function parseFocusArea(
  raw: unknown,
  index: number,
  context: CorpusStudyPlanValidationContext,
): StudyFocusArea {
  if (!raw || typeof raw !== 'object') {
    throw analysisFailed(`focusAreas[${index}] must be an object`);
  }

  const item = raw as Record<string, unknown>;
  const documentId = readNonEmptyString(
    item.documentId,
    `focusAreas[${index}].documentId`,
  );
  const document = context.documentsById.get(documentId);
  if (!document) {
    throw analysisFailed(`focusAreas[${index}] references unknown documentId`);
  }

  const ordinals = context.ordinalsByDocumentId.get(documentId);
  if (!ordinals || ordinals.size === 0) {
    throw analysisFailed(`focusAreas[${index}] has no known chunks for document`);
  }

  const ordinalStart = readNonNegativeInt(
    item.ordinalStart,
    `focusAreas[${index}].ordinalStart`,
  );
  const ordinalEnd = readNonNegativeInt(
    item.ordinalEnd,
    `focusAreas[${index}].ordinalEnd`,
  );
  if (ordinalEnd < ordinalStart) {
    throw analysisFailed(`focusAreas[${index}] ordinalEnd must be >= ordinalStart`);
  }

  if (!rangeOverlapsKnownOrdinals(ordinalStart, ordinalEnd, ordinals)) {
    throw analysisFailed(`focusAreas[${index}] ordinal range does not match excerpts`);
  }

  const label = readNonEmptyString(item.label, `focusAreas[${index}].label`);
  const rationale = readNonEmptyString(
    item.rationale,
    `focusAreas[${index}].rationale`,
  );
  const importance = readImportance(item.importance, index);
  const keyConcepts = readKeyConcepts(item.keyConcepts, index);

  const id =
    typeof item.id === 'string' && item.id.trim().length > 0
      ? item.id.trim()
      : `focus_${index + 1}`;

  const pageStart = readOptionalPage(item.pageStart, `focusAreas[${index}].pageStart`);
  const pageEnd = readOptionalPage(item.pageEnd, `focusAreas[${index}].pageEnd`);

  return {
    id,
    documentId,
    documentTitle: document.title,
    label,
    rationale,
    importance,
    keyConcepts,
    ordinalStart,
    ordinalEnd,
    ...(pageStart !== undefined ? { pageStart } : {}),
    ...(pageEnd !== undefined ? { pageEnd } : {}),
  };
}

function rangeOverlapsKnownOrdinals(
  start: number,
  end: number,
  ordinals: Set<number>,
): boolean {
  for (let ordinal = start; ordinal <= end; ordinal += 1) {
    if (ordinals.has(ordinal)) {
      return true;
    }
  }
  return false;
}

function readImportance(value: unknown, index: number): StudyFocusImportance {
  if (value === 'high' || value === 'medium') {
    return value;
  }
  throw analysisFailed(`focusAreas[${index}].importance must be high or medium`);
}

function readKeyConcepts(value: unknown, index: number): string[] {
  if (!Array.isArray(value) || value.length < 1) {
    throw analysisFailed(`focusAreas[${index}].keyConcepts must be a non-empty array`);
  }
  return value.map((entry, conceptIndex) =>
    readNonEmptyString(
      entry,
      `focusAreas[${index}].keyConcepts[${conceptIndex}]`,
    ),
  );
}

function readNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw analysisFailed(`${field} must be a non-empty string`);
  }
  return value.trim();
}

function readNonNegativeInt(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw analysisFailed(`${field} must be a non-negative integer`);
  }
  return value;
}

function readOptionalPage(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw analysisFailed(`${field} must be a positive integer`);
  }
  return value;
}

function analysisFailed(message: string) {
  return learningGenerationFailed('invalid_llm_output', message);
}
