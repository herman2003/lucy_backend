export type ServerLearningReminderPrefs = {
  enabled: boolean;
  reminderHour: number;
  reminderMinute: number;
  revisionPlanEnabled: boolean;
  timezone: string;
};

export type RevisionReminderPushState = {
  fcmTokens: string[];
  prefs: ServerLearningReminderPrefs;
  lastJnPushLocalDate?: string;
};
