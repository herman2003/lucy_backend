import { Inject, Injectable } from '@nestjs/common';

import type { RevisionReminderPushState } from '../domain/revision-reminder-push.types';
import type { SyncRevisionReminderPushInput } from '../dto/sync-revision-reminder-push.dto';
import {
  REVISION_REMINDER_PUSH_REPOSITORY,
  type RevisionReminderPushRepository,
} from '../repositories/revision-reminder-push.repository.port';

@Injectable()
export class RevisionReminderPushService {
  constructor(
    @Inject(REVISION_REMINDER_PUSH_REPOSITORY)
    private readonly pushRepository: RevisionReminderPushRepository,
  ) {}

  async syncPushState(
    uid: string,
    input: SyncRevisionReminderPushInput,
  ): Promise<RevisionReminderPushState> {
    const existing = await this.pushRepository.getState(uid);
    const tokens = new Set(existing?.fcmTokens ?? []);

    if (input.removeFcmToken) {
      tokens.delete(input.removeFcmToken);
    }
    if (input.fcmToken) {
      tokens.add(input.fcmToken);
    }

    const next: RevisionReminderPushState = {
      prefs: input.prefs,
      fcmTokens: input.prefs.enabled ? [...tokens] : [],
      ...(existing?.lastJnPushLocalDate !== undefined
        ? { lastJnPushLocalDate: existing.lastJnPushLocalDate }
        : {}),
    };

    await this.pushRepository.upsertState(uid, next);
    return next;
  }
}
