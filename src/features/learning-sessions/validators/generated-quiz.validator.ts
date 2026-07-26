import { learningGenerationFailed } from '../utils/learning-generation-failure.error';
import type { LearningSessionQuizItem } from '../domain/learning-session.types';
import type { SearchRetrievalHitDto } from '../../retrieval/dto/search-retrieval.dto';
import { normalizeGeneratedQuizPayload } from './generated-quiz-normalizer';
import { mapLearningSessionSources } from './learning-session-source.mapper';

export function parseGeneratedQuizItems(
  parsed: unknown,
  hits: SearchRetrievalHitDto[],
  expectedCount: number,
): LearningSessionQuizItem[] {
  let record: Record<string, unknown>;
  try {
    record = normalizeGeneratedQuizPayload(parsed, {
      fallbackChunkIds: hits.map((hit) => hit.chunkId),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'items must be an array';
    throw generationFailed(message);
  }

  if (!Array.isArray(record.items)) {
    throw generationFailed('items must be an array');
  }

  if (record.items.length !== expectedCount) {
    throw generationFailed(`expected ${expectedCount} quiz items`);
  }

  return record.items.map((rawItem, index) => parseQuizItem(rawItem, index, hits));
}

function parseQuizItem(
  rawItem: unknown,
  index: number,
  hits: SearchRetrievalHitDto[],
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
  const sources = mapLearningSessionSources(sourceChunkIds, hits);

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

function generationFailed(message: string) {
  return learningGenerationFailed('invalid_llm_output', message);
}
