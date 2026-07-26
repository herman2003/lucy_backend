import type {
  CreateQuizAttemptInput,
  PersistedQuizAttempt,
} from '../domain/quiz-attempt.types';

export const LEARNING_SESSION_ATTEMPTS_REPOSITORY = Symbol(
  'LEARNING_SESSION_ATTEMPTS_REPOSITORY',
);

export interface LearningSessionAttemptsRepository {
  create(
    uid: string,
    sessionId: string,
    input: CreateQuizAttemptInput,
  ): Promise<PersistedQuizAttempt>;

  list(uid: string, sessionId: string): Promise<PersistedQuizAttempt[]>;
}
