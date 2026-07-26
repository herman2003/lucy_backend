import { LucyErrorCodes } from '../../../core/errors/lucy-error-codes';
import { LucyApiError } from '../../../core/errors/lucy-api.error';
import type { ServerLearningReminderPrefs } from '../domain/revision-reminder-push.types';

export type SyncRevisionReminderPushInput = {
  fcmToken?: string;
  removeFcmToken?: string;
  prefs: ServerLearningReminderPrefs;
};

export function parseSyncRevisionReminderPushRequest(
  body: unknown,
): SyncRevisionReminderPushInput {
  if (!body || typeof body !== 'object') {
    throw validationError('Invalid request body');
  }
  const record = body as Record<string, unknown>;
  const prefs = parsePrefs(record.prefs);
  const fcmToken = readOptionalString(record.fcmToken);
  const removeFcmToken = readOptionalString(record.removeFcmToken);
  return { fcmToken, removeFcmToken, prefs };
}

function parsePrefs(value: unknown): ServerLearningReminderPrefs {
  if (!value || typeof value !== 'object') {
    throw validationError('prefs is required');
  }
  const record = value as Record<string, unknown>;
  const enabled = record.enabled;
  const reminderHour = record.reminderHour;
  const reminderMinute = record.reminderMinute;
  const revisionPlanEnabled = record.revisionPlanEnabled;
  const timezone = record.timezone;

  if (typeof enabled !== 'boolean') {
    throw validationError('prefs.enabled must be a boolean');
  }
  if (!isHour(reminderHour)) {
    throw validationError('prefs.reminderHour must be between 0 and 23');
  }
  if (!isMinute(reminderMinute)) {
    throw validationError('prefs.reminderMinute must be between 0 and 59');
  }
  if (typeof revisionPlanEnabled !== 'boolean') {
    throw validationError('prefs.revisionPlanEnabled must be a boolean');
  }
  if (typeof timezone !== 'string' || timezone.trim().length === 0) {
    throw validationError('prefs.timezone is required');
  }

  return {
    enabled,
    reminderHour,
    reminderMinute,
    revisionPlanEnabled,
    timezone: timezone.trim(),
  };
}

function readOptionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw validationError('token must be a non-empty string');
  }
  return value.trim();
}

function isHour(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 23;
}

function isMinute(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 59;
}

function validationError(message: string): LucyApiError {
  return new LucyApiError(400, LucyErrorCodes.VALIDATION_ERROR, message);
}
