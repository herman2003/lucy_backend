export type NormalizeFlashcardsOptions = {
  /** Used when the LLM omits sourceChunkIds but retrieval hits exist. */
  fallbackChunkIds?: string[];
};

/**
 * Maps common LLM JSON drift (root array, alternate keys, singular
 * `sourceChunkId`) to the canonical flashcards generation shape expected by
 * {@link parseGeneratedFlashcardItems}.
 */
export function normalizeGeneratedFlashcardsPayload(
  parsed: unknown,
  options: NormalizeFlashcardsOptions = {},
): Record<string, unknown> {
  const items = extractItemsArray(parsed);
  return {
    items: items.map((rawItem) => normalizeFlashcardItemRecord(rawItem, options)),
  };
}

function extractItemsArray(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('LLM response is not an object or array');
  }

  const record = parsed as Record<string, unknown>;
  for (const key of [
    'items',
    'flashcards',
    'flashcard_items',
    'flashcardItems',
    'cards',
    'card_items',
    'cardItems',
  ] as const) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value;
    }
  }

  throw new Error('items must be an array');
}

function normalizeFlashcardItemRecord(
  rawItem: unknown,
  options: NormalizeFlashcardsOptions,
): Record<string, unknown> {
  if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) {
    return {};
  }

  const item: Record<string, unknown> = {
    ...(rawItem as Record<string, unknown>),
  };

  normalizeFront(item);
  normalizeBack(item);
  normalizeSourceChunkIds(item, options);

  return item;
}

function normalizeFront(item: Record<string, unknown>): void {
  if (typeof item.front === 'string' && item.front.trim()) {
    item.front = item.front.trim();
    return;
  }

  for (const key of ['recto', 'question', 'term', 'prompt'] as const) {
    const value = item[key];
    if (typeof value === 'string' && value.trim()) {
      item.front = value.trim();
      return;
    }
  }
}

function normalizeBack(item: Record<string, unknown>): void {
  if (typeof item.back === 'string' && item.back.trim()) {
    item.back = item.back.trim();
    return;
  }

  for (const key of [
    'verso',
    'answer',
    'definition',
    'response',
    'content',
  ] as const) {
    const value = item[key];
    if (typeof value === 'string' && value.trim()) {
      item.back = value.trim();
      return;
    }
  }
}

function normalizeSourceChunkIds(
  item: Record<string, unknown>,
  options: NormalizeFlashcardsOptions,
): void {
  if (Array.isArray(item.sourceChunkIds) && item.sourceChunkIds.length > 0) {
    return;
  }

  for (const key of ['source_chunk_ids', 'chunkIds', 'chunk_ids', 'sources'] as const) {
    const value = item[key];
    if (!Array.isArray(value) || value.length === 0) {
      continue;
    }

    if (typeof value[0] === 'string') {
      item.sourceChunkIds = value;
      return;
    }

    if (value[0] && typeof value[0] === 'object') {
      const chunkIds = value
        .map((entry) => {
          if (!entry || typeof entry !== 'object') {
            return undefined;
          }
          const record = entry as Record<string, unknown>;
          const chunkId = record.chunkId ?? record.chunk_id ?? record.id;
          return typeof chunkId === 'string' ? chunkId.trim() : undefined;
        })
        .filter((chunkId): chunkId is string => Boolean(chunkId));

      if (chunkIds.length > 0) {
        item.sourceChunkIds = chunkIds;
        return;
      }
    }
  }

  if (typeof item.sourceChunkId === 'string' && item.sourceChunkId.trim()) {
    item.sourceChunkIds = [item.sourceChunkId.trim()];
    return;
  }

  if (Array.isArray(item.sourceChunkId) && item.sourceChunkId.length > 0) {
    const chunkIds = item.sourceChunkId
      .filter((chunkId): chunkId is string => typeof chunkId === 'string' && chunkId.trim().length > 0)
      .map((chunkId) => chunkId.trim());
    if (chunkIds.length > 0) {
      item.sourceChunkIds = chunkIds;
      return;
    }
  }

  const fallback = options.fallbackChunkIds?.find((chunkId) => chunkId.trim().length > 0);
  if (fallback) {
    item.sourceChunkIds = [fallback];
  }
}
