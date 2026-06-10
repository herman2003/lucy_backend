import { Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin';

import type {
  CreateLearningSessionInput,
  PersistedLearningSession,
} from '../domain/learning-session.types';
import type { LearningSessionsRepository } from './learning-sessions.repository.port';

@Injectable()
export class FirestoreLearningSessionsRepository implements LearningSessionsRepository {
  async create(
    uid: string,
    input: CreateLearningSessionInput,
  ): Promise<PersistedLearningSession> {
    const ref = this.sessionsCollection(uid).doc();
    const session: PersistedLearningSession = {
      id: ref.id,
      uid,
      ...input,
    };
    await ref.set(this.toFirestoreData(session));
    return session;
  }

  async getById(
    uid: string,
    sessionId: string,
  ): Promise<PersistedLearningSession | null> {
    const snapshot = await this.sessionsCollection(uid).doc(sessionId).get();
    if (!snapshot.exists) {
      return null;
    }
    return this.fromFirestoreData(uid, sessionId, snapshot.data() ?? {});
  }

  async list(uid: string): Promise<PersistedLearningSession[]> {
    const snapshot = await this.sessionsCollection(uid)
      .orderBy('createdAt', 'desc')
      .get();
    return snapshot.docs.map((doc) =>
      this.fromFirestoreData(uid, doc.id, doc.data()),
    );
  }

  async delete(uid: string, sessionId: string): Promise<void> {
    const ref = this.sessionsCollection(uid).doc(sessionId);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      throw new Error('Learning session not found');
    }
    await ref.delete();
  }

  private sessionsCollection(uid: string) {
    return admin.firestore().collection('users').doc(uid).collection('learningSessions');
  }

  private toFirestoreData(
    session: PersistedLearningSession,
  ): Record<string, unknown> {
    const { id: _id, uid: _uid, ...rest } = session;
    return rest;
  }

  private fromFirestoreData(
    uid: string,
    id: string,
    data: FirebaseFirestore.DocumentData,
  ): PersistedLearningSession {
    return {
      id,
      uid,
      type: data.type,
      status: data.status,
      itemCount: data.itemCount,
      title: data.title,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      activeDocumentCount: data.activeDocumentCount,
      ...(typeof data.sourceChatId === 'string'
        ? { sourceChatId: data.sourceChatId }
        : {}),
      items: data.items ?? [],
    };
  }
}
