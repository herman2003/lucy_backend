import type { LearningSessionType } from '../domain/learning-session.types';

export const LEARNING_SESSION_ITEM_LIMITS: Record<
  LearningSessionType,
  { defaultCount: number; maxCount: number }
> = {
  quiz: { defaultCount: 5, maxCount: 15 },
  flashcards: { defaultCount: 10, maxCount: 30 },
};
