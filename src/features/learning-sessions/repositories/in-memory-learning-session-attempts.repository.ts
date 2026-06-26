import { Injectable } from '@nestjs/common';

import type {
  CreateQuizAttemptInput,
  PersistedQuizAttempt,
} from '../domain/quiz-attempt.types';
import type { LearningSessionAttemptsRepository } from './learning-session-attempts.repository.port';

@Injectable()
export class InMemoryLearningSessionAttemptsRepository
  implements LearningSessionAttemptsRepository
{
  private readonly attemptsBySession = new Map<string, PersistedQuizAttempt[]>();

  async create(
    uid: string,
    sessionId: string,
    input: CreateQuizAttemptInput,
  ): Promise<PersistedQuizAttempt> {
    const key = this.key(uid, sessionId);
    const attempt: PersistedQuizAttempt = {
      ...input,
      sessionId,
    };
    const list = this.attemptsBySession.get(key) ?? [];
    const existingIndex = list.findIndex((entry) => entry.id === attempt.id);
    if (existingIndex >= 0) {
      list[existingIndex] = attempt;
    } else {
      list.push(attempt);
    }
    this.attemptsBySession.set(key, list);
    return attempt;
  }

  async list(uid: string, sessionId: string): Promise<PersistedQuizAttempt[]> {
    const list = [...(this.attemptsBySession.get(this.key(uid, sessionId)) ?? [])];
    list.sort((a, b) => b.completedAt.localeCompare(a.completedAt));
    return list;
  }

  private key(uid: string, sessionId: string): string {
    return `${uid}:${sessionId}`;
  }
}
