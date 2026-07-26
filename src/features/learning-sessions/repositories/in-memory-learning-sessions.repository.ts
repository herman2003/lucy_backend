import { Injectable } from '@nestjs/common';

import type {
  CreateLearningSessionInput,
  PersistedLearningSession,
} from '../domain/learning-session.types';
import type { LearningSessionsRepository } from './learning-sessions.repository.port';

@Injectable()
export class InMemoryLearningSessionsRepository implements LearningSessionsRepository {
  private readonly sessionsByUid = new Map<string, PersistedLearningSession[]>();

  async create(
    uid: string,
    input: CreateLearningSessionInput,
  ): Promise<PersistedLearningSession> {
    const session: PersistedLearningSession = {
      id: this.newId(),
      uid,
      ...input,
    };
    const list = this.sessionsByUid.get(uid) ?? [];
    list.push(session);
    this.sessionsByUid.set(uid, list);
    return session;
  }

  async getById(
    uid: string,
    sessionId: string,
  ): Promise<PersistedLearningSession | null> {
    return this.findSession(uid, sessionId) ?? null;
  }

  async list(uid: string): Promise<PersistedLearningSession[]> {
    const list = [...(this.sessionsByUid.get(uid) ?? [])];
    list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return list;
  }

  async delete(uid: string, sessionId: string): Promise<void> {
    const sessions = this.sessionsByUid.get(uid) ?? [];
    const index = sessions.findIndex((session) => session.id === sessionId);
    if (index < 0) {
      throw new Error('Learning session not found');
    }
    sessions.splice(index, 1);
    this.sessionsByUid.set(uid, sessions);
  }

  private findSession(
    uid: string,
    sessionId: string,
  ): PersistedLearningSession | undefined {
    return (this.sessionsByUid.get(uid) ?? []).find(
      (session) => session.id === sessionId,
    );
  }

  private newId(): string {
    return `learn_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
  }
}
