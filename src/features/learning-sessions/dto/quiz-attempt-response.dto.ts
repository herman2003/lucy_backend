import type { PersistedQuizAttempt } from '../domain/quiz-attempt.types';

export type QuizAttemptResponseDto = PersistedQuizAttempt;

export function buildQuizAttemptResponse(
  attempt: PersistedQuizAttempt,
): QuizAttemptResponseDto {
  return attempt;
}
