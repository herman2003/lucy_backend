import { LucyErrorCodes } from '../../../core/errors/lucy-error-codes';
import { LucyApiError } from '../../../core/errors/lucy-api.error';
import type {
  LearningSessionQuizItem,
  LearningSessionSource,
} from '../domain/learning-session.types';
import type { SearchRetrievalHitDto } from '../../retrieval/dto/search-retrieval.dto';

export function parseGeneratedQuizItems(
  parsed: unknown,
  hits: SearchRetrievalHitDto[],
  expectedCount: number,
): LearningSessionQuizItem[] {
  if (!parsed || typeof parsed !== 'object') {
    throw generationFailed('LLM response is not an object');
  }

  const record = parsed as Record<string, unknown>;
  if (!Array.isArray(record.items)) {
    throw generationFailed('items must be an array');
  }

  if (record.items.length !== expectedCount) {
    throw generationFailed(`expected ${expectedCount} quiz items`);
  }

  const hitsByChunkId = new Map(hits.map((hit) => [hit.chunkId, hit]));

  return record.items.map((rawItem, index) =>
    parseQuizItem(rawItem, index, hitsByChunkId),
  );
}

function parseQuizItem(
  rawItem: unknown,
  index: number,
  hitsByChunkId: Map<string, SearchRetrievalHitDto>,
): LearningSessionQuizItem {
  if (!rawItem || typeof rawItem !== 'object') {
    throw generationFailed(`items[${index}] must be an object`);
  }

  const item = rawItem as Record<string, unknown>;
  const question = readNonEmptyString(item.question, `items[${index}].question`);
  const choices = readChoices(item.choices, index);
  const correctIndex = readCorrectIndex(item.correctIndex, index);
  const explanation = readNonEmptyString(
    item.explanation,
    `items[${index}].explanation`,
  );
  const sourceChunkIds = readSourceChunkIds(item.sourceChunkIds, index);
  const sources = mapSources(sourceChunkIds, hitsByChunkId, index);

  if (sources.length === 0) {
    throw generationFailed(`items[${index}] must reference at least one known chunk`);
  }

  return {
    id: `item-${index + 1}`,
    question,
    choices,
    correctIndex,
    explanation,
    sources,
  };
}

function readChoices(value: unknown, index: number): [string, string, string, string] {
  if (!Array.isArray(value) || value.length !== 4) {
    throw generationFailed(`items[${index}].choices must contain exactly 4 strings`);
  }
  const choices = value.map((choice, choiceIndex) => {
    if (typeof choice !== 'string' || !choice.trim()) {
      throw generationFailed(`items[${index}].choices[${choiceIndex}] must be a non-empty string`);
    }
    return choice.trim();
  });
  return choices as [string, string, string, string];
}

function readCorrectIndex(value: unknown, index: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 3) {
    throw generationFailed(`items[${index}].correctIndex must be an integer between 0 and 3`);
  }
  return value;
}

function readSourceChunkIds(value: unknown, index: number): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw generationFailed(`items[${index}].sourceChunkIds must be a non-empty array`);
  }
  return value.map((chunkId, chunkIndex) => {
    if (typeof chunkId !== 'string' || !chunkId.trim()) {
      throw generationFailed(
        `items[${index}].sourceChunkIds[${chunkIndex}] must be a non-empty string`,
      );
    }
    return chunkId.trim();
  });
}

function readNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw generationFailed(`${field} must be a non-empty string`);
  }
  return value.trim();
}

function mapSources(
  chunkIds: string[],
  hitsByChunkId: Map<string, SearchRetrievalHitDto>,
  index: number,
): LearningSessionSource[] {
  const uniqueIds = [...new Set(chunkIds)];
  const sources: LearningSessionSource[] = [];

  for (const chunkId of uniqueIds) {
    const hit = hitsByChunkId.get(chunkId);
    if (!hit) {
      throw generationFailed(`items[${index}] references unknown chunkId ${chunkId}`);
    }
    sources.push({
      chunkId: hit.chunkId,
      documentId: hit.documentId,
      title: hit.title,
      excerpt: hit.text.slice(0, 240),
      ...(hit.pageStart !== undefined ? { pageStart: hit.pageStart } : {}),
      ...(hit.pageEnd !== undefined ? { pageEnd: hit.pageEnd } : {}),
    });
  }

  return sources;
}

function generationFailed(message: string): LucyApiError {
  return new LucyApiError(502, LucyErrorCodes.LEARNING_GENERATION_FAILED, message);
}
