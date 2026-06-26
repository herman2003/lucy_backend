import { Inject, Injectable } from '@nestjs/common';

import { LucyErrorCodes } from '../../../core/errors/lucy-error-codes';
import { LucyApiError } from '../../../core/errors/lucy-api.error';
import { parseCreateQuizAttemptRequest } from '../dto/create-quiz-attempt.dto';
import type { PersistedQuizAttempt } from '../domain/quiz-attempt.types';
import {
  LEARNING_SESSIONS_REPOSITORY,
  type LearningSessionsRepository,
} from '../repositories/learning-sessions.repository.port';
import {
  LEARNING_SESSION_ATTEMPTS_REPOSITORY,
  type LearningSessionAttemptsRepository,
} from '../repositories/learning-session-attempts.repository.port';

@Injectable()
export class LearningSessionAttemptsService {
  constructor(
    @Inject(LEARNING_SESSIONS_REPOSITORY)
    private readonly sessionsRepository: LearningSessionsRepository,
    @Inject(LEARNING_SESSION_ATTEMPTS_REPOSITORY)
    private readonly attemptsRepository: LearningSessionAttemptsRepository,
  ) {}

  async recordAttempt(
    uid: string,
    sessionId: string,
    body: unknown,
  ): Promise<PersistedQuizAttempt> {
    await this.requireSession(uid, sessionId);
    const input = parseCreateQuizAttemptRequest(body);
    return this.attemptsRepository.create(uid, sessionId, input);
  }

  async listAttempts(
    uid: string,
    sessionId: string,
  ): Promise<PersistedQuizAttempt[]> {
    await this.requireSession(uid, sessionId);
    return this.attemptsRepository.list(uid, sessionId);
  }

  private async requireSession(uid: string, sessionId: string): Promise<void> {
    const session = await this.sessionsRepository.getById(uid, sessionId);
    if (!session) {
      throw new LucyApiError(
        404,
        LucyErrorCodes.LEARNING_SESSION_NOT_FOUND,
        'Learning session not found',
      );
    }
  }
}
