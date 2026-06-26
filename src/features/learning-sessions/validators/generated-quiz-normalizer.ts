export type NormalizeQuizOptions = {
  /** Used when the LLM omits sourceChunkIds but retrieval hits exist. */
  fallbackChunkIds?: string[];
};

/**
 * Maps common LLM JSON drift (root array, `quiz_questions`, `options` objects,
 * snake_case) to the canonical quiz generation shape expected by
 * {@link parseGeneratedQuizItems}.
 */
export function normalizeGeneratedQuizPayload(
  parsed: unknown,
  options: NormalizeQuizOptions = {},
): Record<string, unknown> {
  const items = extractItemsArray(parsed);
  return {
    items: items.map((rawItem) => normalizeQuizItemRecord(rawItem, options)),
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
    'questions',
    'quiz_items',
    'quizItems',
    'quiz_questions',
    'quizQuestions',
    'quiz',
  ] as const) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value;
    }
  }

  throw new Error('items must be an array');
}

function normalizeQuizItemRecord(
  rawItem: unknown,
  options: NormalizeQuizOptions,
): Record<string, unknown> {
  if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) {
    return {};
  }

  const item: Record<string, unknown> = {
    ...(rawItem as Record<string, unknown>),
  };

  normalizeQuestionField(item);
  normalizeChoicesAndCorrectIndex(item);
  normalizeExplanation(item);
  normalizeSourceChunkIds(item, options);

  return item;
}

function normalizeQuestionField(item: Record<string, unknown>): void {
  if (typeof item.question === 'string' && item.question.trim()) {
    item.question = item.question.trim();
    return;
  }

  for (const key of ['question_text', 'questionText', 'text', 'prompt'] as const) {
    const value = item[key];
    if (typeof value === 'string' && value.trim()) {
      item.question = value.trim();
      return;
    }
  }
}

function normalizeChoicesAndCorrectIndex(item: Record<string, unknown>): void {
  if (areFourStringChoices(item.choices)) {
    item.choices = (item.choices as string[]).map((choice) => choice.trim());
    applyCorrectIndexFallbacks(item);
    return;
  }

  const candidateArrays = [
    item.choices,
    item.options,
    item.answers,
    item.question_choices,
    item.questionChoices,
  ].filter((value): value is unknown[] => Array.isArray(value));

  for (const candidate of candidateArrays) {
    const parsed = parseChoiceObjects(candidate, item);
    if (!parsed || parsed.choices.length !== 4) {
      continue;
    }

    item.choices = parsed.choices;
    if (typeof item.correctIndex !== 'number' && parsed.correctIndex !== undefined) {
      item.correctIndex = parsed.correctIndex;
    }
    break;
  }

  applyCorrectIndexFallbacks(item);
}

function areFourStringChoices(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length === 4 &&
    value.every((choice) => typeof choice === 'string' && choice.trim().length > 0)
  );
}

function parseChoiceObjects(
  options: unknown[],
  item: Record<string, unknown>,
): { choices: string[]; correctIndex?: number } | null {
  const choices: string[] = [];
  const optionIds: string[] = [];
  let correctIndex: number | undefined;

  for (const [index, option] of options.entries()) {
    if (typeof option === 'string' && option.trim()) {
      choices.push(option.trim());
      optionIds.push('');
      continue;
    }

    if (!option || typeof option !== 'object') {
      continue;
    }

    const record = option as Record<string, unknown>;
    const text = readOptionText(record);
    if (!text) {
      continue;
    }

    choices.push(text);
    optionIds.push(readOptionId(record) ?? '');

    if (
      record.isCorrect === true ||
      record.is_correct === true ||
      record.correct === true
    ) {
      correctIndex = index;
    }
  }

  if (choices.length !== 4) {
    return null;
  }

  if (correctIndex === undefined) {
    correctIndex = resolveCorrectIndexFromItem(item, optionIds);
  }

  return { choices, correctIndex };
}

function applyCorrectIndexFallbacks(item: Record<string, unknown>): void {
  if (typeof item.correctIndex === 'number') {
    return;
  }

  for (const key of [
    'correct_index',
    'correctIndex',
    'correct_answer_index',
  ] as const) {
    const value = item[key];
    if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 3) {
      item.correctIndex = value;
      return;
    }
  }

  const letter = item.correct_answer ?? item.correctAnswer;
  if (typeof letter === 'string' && /^[A-D]$/i.test(letter.trim())) {
    item.correctIndex = letter.trim().toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0);
  }
}

function resolveCorrectIndexFromItem(
  item: Record<string, unknown>,
  optionIds: string[],
): number | undefined {
  for (const key of [
    'correct_option_id',
    'correct_choice_id',
    'correctOptionId',
    'correctChoiceId',
    'correct_id',
  ] as const) {
    const id = item[key];
    if (typeof id !== 'string' || !id.trim()) {
      continue;
    }
    const index = optionIds.findIndex((optionId) => optionId === id.trim());
    if (index >= 0) {
      return index;
    }
  }

  const letter = item.correct_answer ?? item.correctAnswer;
  if (typeof letter === 'string' && /^[A-D]$/i.test(letter.trim())) {
    return letter.trim().toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0);
  }

  return undefined;
}

function readOptionText(record: Record<string, unknown>): string | undefined {
  for (const key of [
    'choice_text',
    'choiceText',
    'option_text',
    'optionText',
    'text',
    'label',
    'answer',
    'content',
  ] as const) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function readOptionId(record: Record<string, unknown>): string | undefined {
  for (const key of ['option_id', 'optionId', 'choice_id', 'choiceId', 'id'] as const) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function normalizeExplanation(item: Record<string, unknown>): void {
  if (typeof item.explanation === 'string' && item.explanation.trim()) {
    item.explanation = item.explanation.trim();
    return;
  }

  for (const key of ['rationale', 'feedback', 'reason'] as const) {
    const value = item[key];
    if (typeof value === 'string' && value.trim()) {
      item.explanation = value.trim();
      return;
    }
  }

  item.explanation = 'Réponse dérivée des extraits fournis.';
}

function normalizeSourceChunkIds(
  item: Record<string, unknown>,
  options: NormalizeQuizOptions,
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

  const fallback = options.fallbackChunkIds?.find((chunkId) => chunkId.trim().length > 0);
  if (fallback) {
    item.sourceChunkIds = [fallback];
  }
}
