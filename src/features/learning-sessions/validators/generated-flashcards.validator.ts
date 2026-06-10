import { LucyErrorCodes } from '../../../core/errors/lucy-error-codes';
import { LucyApiError } from '../../../core/errors/lucy-api.error';
import type {
  LearningSessionFlashcardItem,
  LearningSessionSource,
} from '../domain/learning-session.types';
import type { SearchRetrievalHitDto } from '../../retrieval/dto/search-retrieval.dto';

export function parseGeneratedFlashcardItems(
  parsed: unknown,
  hits: SearchRetrievalHitDto[],
  expectedCount: number,
): LearningSessionFlashcardItem[] {
  if (!parsed || typeof parsed !== 'object') {
    throw generationFailed('LLM response is not an object');
  }

  const record = parsed as Record<string, unknown>;
  if (!Array.isArray(record.items)) {
    throw generationFailed('items must be an array');
  }

  if (record.items.length !== expectedCount) {
    throw generationFailed(`expected ${expectedCount} flashcard items`);
  }

  const hitsByChunkId = new Map(hits.map((hit) => [hit.chunkId, hit]));

  return record.items.map((rawItem, index) =>
    parseFlashcardItem(rawItem, index, hitsByChunkId),
  );
}

function parseFlashcardItem(
  rawItem: unknown,
  index: number,
  hitsByChunkId: Map<string, SearchRetrievalHitDto>,
): LearningSessionFlashcardItem {
  if (!rawItem || typeof rawItem !== 'object') {
    throw generationFailed(`items[${index}] must be an object`);
  }

  const item = rawItem as Record<string, unknown>;
  const front = readNonEmptyString(item.front, `items[${index}].front`);
  const back = readNonEmptyString(item.back, `items[${index}].back`);
  const sourceChunkIds = readSourceChunkIds(item.sourceChunkIds, index);
  const sources = mapSources(sourceChunkIds, hitsByChunkId, index);

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
