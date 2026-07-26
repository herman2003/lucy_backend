import type { PersistedChatThread } from '../../chat/domain/chat.types';
import type { CorpusStudyPlan } from '../../learning-sessions/domain/study-focus-area.types';
import {
  pickRevisionJnReminder,
  isReminderSlot,
  formatLocalDateKey,
} from './revision-jn-reminder.util';

const focusAreas = [
  {
    id: 'a1',
    documentId: 'd1',
    documentTitle: 'Thermo',
    label: 'Entropie',
    ordinalStart: 1,
    ordinalEnd: 2,
    importance: 'high' as const,
    rationale: 'r',
    keyConcepts: ['S'],
  },
  {
    id: 'a2',
    documentId: 'd1',
    documentTitle: 'Thermo',
    label: 'ΔS',
    ordinalStart: 3,
    ordinalEnd: 4,
    importance: 'medium' as const,
    rationale: 'r',
    keyConcepts: ['delta'],
  },
];

function thread(
  overrides: Partial<PersistedChatThread> & { id: string },
): PersistedChatThread {
  return {
    uid: 'u1',
    title: 'Chat',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function plan(focusAreasList = focusAreas): CorpusStudyPlan {
  const now = new Date('2026-06-10T00:00:00.000Z');
  return {
    generatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    focusAreas: focusAreasList,
  };
}

describe('pickRevisionJnReminder', () => {
  it('returns today J-N focus labels when exam date is known', () => {
    const threads = [
      thread({
        id: 'c1',
        revisionExamDate: '2026-06-13T00:00:00.000Z',
        corpusStudyPlan: plan(),
      }),
    ];
    const now = new Date('2026-06-10T12:00:00.000Z');

    const reminder = pickRevisionJnReminder(threads, now);

    expect(reminder).not.toBeNull();
    expect(reminder!.daysBeforeExam).toBe(3);
    expect(reminder!.focusLabels).toContain('Entropie');
  });

  it('returns null when no thread has exam date and plan', () => {
    const reminder = pickRevisionJnReminder(
      [thread({ id: 'c1', corpusStudyPlan: plan() })],
      new Date('2026-06-10T12:00:00.000Z'),
    );
    expect(reminder).toBeNull();
  });
});

describe('isReminderSlot', () => {
  it('matches user local hour and minute', () => {
    const now = new Date('2026-06-10T16:00:00.000Z');
    expect(
      isReminderSlot(now, {
        reminderHour: 18,
        reminderMinute: 0,
        timezone: 'Europe/Paris',
      }),
    ).toBe(true);
  });
});

describe('formatLocalDateKey', () => {
  it('formats YYYY-MM-DD in user timezone', () => {
    const key = formatLocalDateKey(
      new Date('2026-06-10T22:30:00.000Z'),
      'Europe/Paris',
    );
    expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
