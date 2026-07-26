import type { RevisionReminderPushState } from '../domain/revision-reminder-push.types';

export const REVISION_REMINDER_PUSH_REPOSITORY = Symbol(
  'REVISION_REMINDER_PUSH_REPOSITORY',
);

export interface RevisionReminderPushRepository {
  getState(uid: string): Promise<RevisionReminderPushState | null>;

  upsertState(
    uid: string,
    state: RevisionReminderPushState,
  ): Promise<void>;

  listEligibleUserIds(): Promise<string[]>;
}
