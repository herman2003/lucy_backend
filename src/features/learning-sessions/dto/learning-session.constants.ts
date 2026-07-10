import type { LearningSessionType } from '../domain/learning-session.types';

export const LEARNING_SESSION_ITEM_LIMITS: Record<
  LearningSessionType,
  { defaultCount: number; maxCount: number }
> = {
  quiz: { defaultCount: 5, maxCount: 15 },
  flashcards: { defaultCount: 10, maxCount: 30 },
};

export const QUIZ_RETRIEVAL_QUERY =
  'Important concepts, definitions, and facts from the learning material';

export function quizRetrievalLimit(itemCount: number): number {
  return Math.min(Math.max(itemCount * 4, 5), 20);
}

export const FLASHCARDS_RETRIEVAL_QUERY =
  'Key terms, definitions, and concepts suitable for flashcard memorization';

export function flashcardsRetrievalLimit(itemCount: number): number {
  return Math.min(Math.max(itemCount * 3, 8), 25);
}

export const QUIZ_GENERATION_JSON_SCHEMA = {
  type: 'object',
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        required: [
          'question',
          'choices',
          'correctIndex',
          'explanation',
          'sourceChunkIds',
        ],
        properties: {
          question: { type: 'string' },
          choices: {
            type: 'array',
            items: { type: 'string' },
            minItems: 4,
            maxItems: 4,
          },
          correctIndex: { type: 'integer' },
          explanation: { type: 'string' },
          sourceChunkIds: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
          },
        },
      },
    },
  },
} as const;

export const FLASHCARDS_GENERATION_JSON_SCHEMA = {
  type: 'object',
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        required: ['front', 'back', 'sourceChunkIds'],
        properties: {
          front: { type: 'string' },
          back: { type: 'string' },
          sourceChunkIds: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
          },
        },
      },
    },
  },
} as const;

export const CORPUS_STUDY_ANALYSIS_JSON_SCHEMA = {
  type: 'object',
  required: ['focusAreas'],
  properties: {
    focusAreas: {
      type: 'array',
      items: {
        type: 'object',
        required: [
          'documentId',
          'label',
          'ordinalStart',
          'ordinalEnd',
          'importance',
          'rationale',
          'keyConcepts',
        ],
        properties: {
          id: { type: 'string' },
          documentId: { type: 'string' },
          label: { type: 'string' },
          ordinalStart: { type: 'integer' },
          ordinalEnd: { type: 'integer' },
          pageStart: { type: 'integer' },
          pageEnd: { type: 'integer' },
          importance: { type: 'string', enum: ['high', 'medium'] },
          rationale: { type: 'string' },
          keyConcepts: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
          },
        },
      },
    },
  },
} as const;

export const CORPUS_STUDY_SAMPLE_QUERIES = [
  'Key concepts definitions introduction overview',
  'Important theorems examples applications',
  'Core ideas for memorization and exam preparation',
] as const;

export const CORPUS_STUDY_MAX_EXCERPTS = 30;

export const CORPUS_STUDY_ANALYSIS_MAX_ATTEMPTS = 4;

export const CORPUS_STUDY_PLAN_TTL_MS = 24 * 60 * 60 * 1000;
