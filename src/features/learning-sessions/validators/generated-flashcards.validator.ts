import type { LearningSessionFlashcardItem } from '../domain/learning-session.types';
import type { SearchRetrievalHitDto } from '../../retrieval/dto/search-retrieval.dto';
import { learningGenerationFailed } from '../utils/learning-generation-failure.error';
import { normalizeGeneratedFlashcardsPayload } from './generated-flashcards-normalizer';
import { mapLearningSessionSources } from './learning-session-source.mapper';

export function parseGeneratedFlashcardItems(
  parsed: unknown,
  hits: SearchRetrievalHitDto[],
  expectedCount: number,
): LearningSessionFlashcardItem[] {
  let record: Record<string, unknown>;
  try {
    record = normalizeGeneratedFlashcardsPayload(parsed, {
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
    throw generationFailed(`expected ${expectedCount} flashcard items`);
  }

  return record.items.map((rawItem, index) => parseFlashcardItem(rawItem, index, hits));
}

function parseFlashcardItem(
  rawItem: unknown,
  index: number,
  hits: SearchRetrievalHitDto[],
): LearningSessionFlashcardItem {
  if (!rawItem || typeof rawItem !== 'object') {
    throw generationFailed(`items[${index}] must be an object`);
  }

  const item = rawItem as Record<string, unknown>;
  const front = readNonEmptyString(item.front, `items[${index}].front`);
  const back = readNonEmptyString(item.back, `items[${index}].back`);
  const sourceChunkIds = readSourceChunkIds(item.sourceChunkIds, index);
  const sources = mapLearningSessionSources(sourceChunkIds, hits);

  if (sources.length === 0) {
    throw generationFailed(`items[${index}] must reference at least one known chunk`);
  }

  return {
    id: `item-${index + 1}`,
    front,
    back,
    sources,
  };
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
