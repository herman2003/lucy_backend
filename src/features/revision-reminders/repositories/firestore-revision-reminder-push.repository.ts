import { Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin';

import type { RevisionReminderPushState } from '../domain/revision-reminder-push.types';
import type { RevisionReminderPushRepository } from './revision-reminder-push.repository.port';

type FirestoreRevisionReminderPush = RevisionReminderPushState;

@Injectable()
export class FirestoreRevisionReminderPushRepository
  implements RevisionReminderPushRepository
{
  async getState(uid: string): Promise<RevisionReminderPushState | null> {
    const snapshot = await admin.firestore().collection('users').doc(uid).get();
    if (!snapshot.exists) {
      return null;
    }
    const data = snapshot.data()?.revisionReminderPush;
    if (!isPushState(data)) {
      return null;
    }
    return data;
  }

  async upsertState(
    uid: string,
    state: RevisionReminderPushState,
  ): Promise<void> {
    await admin
      .firestore()
      .collection('users')
      .doc(uid)
      .set({ revisionReminderPush: state }, { merge: true });
  }

  async listEligibleUserIds(): Promise<string[]> {
    const snapshot = await admin
      .firestore()
      .collection('users')
      .where('revisionReminderPush.prefs.enabled', '==', true)
      .where('revisionReminderPush.prefs.revisionPlanEnabled', '==', true)
      .get();
    return snapshot.docs.map((doc) => doc.id);
  }
}

function isPushState(value: unknown): value is FirestoreRevisionReminderPush {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  const prefs = record.prefs;
  if (!prefs || typeof prefs !== 'object') {
    return false;
  }
  const prefsRecord = prefs as Record<string, unknown>;
  return (
    Array.isArray(record.fcmTokens) &&
    typeof prefsRecord.enabled === 'boolean' &&
    typeof prefsRecord.reminderHour === 'number' &&
    typeof prefsRecord.reminderMinute === 'number' &&
    typeof prefsRecord.revisionPlanEnabled === 'boolean' &&
    typeof prefsRecord.timezone === 'string'
  );
}
