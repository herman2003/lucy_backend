import { Injectable } from '@nestjs/common';

import type { RevisionReminderPushState } from '../domain/revision-reminder-push.types';
import type { RevisionReminderPushRepository } from './revision-reminder-push.repository.port';

@Injectable()
export class InMemoryRevisionReminderPushRepository
  implements RevisionReminderPushRepository
{
  private readonly pushByUid = new Map<string, RevisionReminderPushState>();

  async getState(uid: string): Promise<RevisionReminderPushState | null> {
    const state = this.pushByUid.get(uid);
    return state ? structuredClone(state) : null;
  }

  async upsertState(
    uid: string,
    state: RevisionReminderPushState,
  ): Promise<void> {
    this.pushByUid.set(uid, structuredClone(state));
  }

  async listEligibleUserIds(): Promise<string[]> {
    const eligible: string[] = [];
    for (const [uid, state] of this.pushByUid.entries()) {
      if (
        state.prefs.enabled &&
        state.prefs.revisionPlanEnabled &&
        state.fcmTokens.length > 0
      ) {
        eligible.push(uid);
      }
    }
    return eligible;
  }
}
