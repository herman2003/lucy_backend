import type { PersistedChatThread } from '../../chat/domain/chat.types';
import { getValidCorpusStudyPlan } from '../../chat/utils/corpus-study-plan-cache';
import { buildRevisionCalendarEntries } from '../../learning-sessions/utils/revision-calendar.util';

export type RevisionJnReminderPayload = {
  daysBeforeExam: number;
  focusLabels: string[];
  chatId: string;
  chatTitle: string;
};

export type ReminderSlotPrefs = {
  reminderHour: number;
  reminderMinute: number;
  timezone: string;
};

export function pickRevisionJnReminder(
  threads: PersistedChatThread[],
  now: Date,
): RevisionJnReminderPayload | null {
  let best: RevisionJnReminderPayload | null = null;
  let bestExamTime = Number.POSITIVE_INFINITY;

  for (const thread of threads) {
    if (!thread.revisionExamDate) {
      continue;
    }
    const corpusStudyPlan = getValidCorpusStudyPlan(
      thread.corpusStudyPlan,
      now.getTime(),
    );
    if (!corpusStudyPlan || corpusStudyPlan.focusAreas.length === 0) {
      continue;
    }

    const examDate = new Date(thread.revisionExamDate);
    const examTime = startOfUtcDay(examDate).getTime();
    if (examTime < startOfUtcDay(now).getTime()) {
      continue;
    }

    const entries = buildRevisionCalendarEntries(
      corpusStudyPlan.focusAreas,
      examDate,
      now,
    );
    const todayEntry = entries.find(
      (entry) =>
        startOfUtcDay(entry.date).getTime() === startOfUtcDay(now).getTime(),
    );
    if (!todayEntry || todayEntry.focusLabels.length === 0) {
      continue;
    }

    if (examTime < bestExamTime) {
      bestExamTime = examTime;
      best = {
        daysBeforeExam: todayEntry.daysBeforeExam,
        focusLabels: todayEntry.focusLabels,
        chatId: thread.id,
        chatTitle: thread.title,
      };
    }
  }

  return best;
}

export function isReminderSlot(now: Date, prefs: ReminderSlotPrefs): boolean {
  const local = getLocalTimeParts(now, prefs.timezone);
  return (
    local.hour === prefs.reminderHour && local.minute === prefs.reminderMinute
  );
}

export function formatLocalDateKey(now: Date, timezone: string): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now);
}

function getLocalTimeParts(
  date: Date,
  timeZone: string,
): { hour: number; minute: number } {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0');
  const minute = Number(
    parts.find((part) => part.type === 'minute')?.value ?? '0',
  );
  return { hour, minute };
}

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}
