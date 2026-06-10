import type {
  CreateLearningSessionInput,
  PersistedLearningSession,
} from '../domain/learning-session.types';

export const LEARNING_SESSIONS_REPOSITORY = Symbol('LEARNING_SESSIONS_REPOSITORY');

export interface LearningSessionsRepository {
  create(
    uid: string,
    input: CreateLearningSessionInput,
  ): Promise<PersistedLearningSession>;

  getById(
    uid: string,
    sessionId: string,
  ): Promise<PersistedLearningSession | null>;

  list(uid: string): Promise<PersistedLearningSession[]>;

  delete(uid: string, sessionId: string): Promise<void>;
}
