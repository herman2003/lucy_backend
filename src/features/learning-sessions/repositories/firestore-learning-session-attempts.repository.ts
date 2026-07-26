import { Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin';

import type {
  CreateQuizAttemptInput,
  PersistedQuizAttempt,
} from '../domain/quiz-attempt.types';
import type { LearningSessionAttemptsRepository } from './learning-session-attempts.repository.port';

@Injectable()
export class FirestoreLearningSessionAttemptsRepository
  implements LearningSessionAttemptsRepository
{
  async create(
    uid: string,
    sessionId: string,
    input: CreateQuizAttemptInput,
  ): Promise<PersistedQuizAttempt> {
    const attempt: PersistedQuizAttempt = {
      ...input,
      sessionId,
    };
    await this.attemptsCollection(uid, sessionId)
      .doc(attempt.id)
      .set(this.toFirestoreData(attempt));
    return attempt;
  }

  async list(uid: string, sessionId: string): Promise<PersistedQuizAttempt[]> {
    const snapshot = await this.attemptsCollection(uid, sessionId)
      .orderBy('completedAt', 'desc')
      .get();
    return snapshot.docs.map((doc) =>
      this.fromFirestoreData(sessionId, doc.id, doc.data()),
    );
  }

  private attemptsCollection(uid: string, sessionId: string) {
    return admin
      .firestore()
      .collection('users')
      .doc(uid)
      .collection('learningSessions')
      .doc(sessionId)
      .collection('attempts');
  }

  private toFirestoreData(
    attempt: PersistedQuizAttempt,
  ): Record<string, unknown> {
    const { id: _id, sessionId: _sessionId, ...rest } = attempt;
    return rest;
  }

  private fromFirestoreData(
    sessionId: string,
    id: string,
    data: FirebaseFirestore.DocumentData,
  ): PersistedQuizAttempt {
    return {
      id,
      sessionId,
      startedAt: data.startedAt,
      completedAt: data.completedAt,
      scoreCorrect: data.scoreCorrect,
      scoreTotal: data.scoreTotal,
      answers: data.answers ?? [],
    };
  }
}
