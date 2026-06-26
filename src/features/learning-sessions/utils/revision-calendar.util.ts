import type { StudyFocusArea } from '../domain/study-focus-area.types';
import type { TutoringLanguage } from '../../onboarding/domain/learner-profile.enums';

const DAY_MS = 24 * 60 * 60 * 1000;

export type RevisionCalendarEntry = {
  daysBeforeExam: number;
  date: Date;
  focusLabels: string[];
  isExamDay: boolean;
};

export function buildRevisionCalendarEntries(
  focusAreas: StudyFocusArea[],
  examDate: Date,
  now: Date,
): RevisionCalendarEntry[] {
  const start = startOfUtcDay(now);
  const exam = startOfUtcDay(examDate);
  if (exam.getTime() < start.getTime()) {
    return [];
  }

  const entries: RevisionCalendarEntry[] = [];
  for (
    let cursor = start;
    cursor.getTime() <= exam.getTime();
    cursor = addUtcDays(cursor, 1)
  ) {
    const daysBeforeExam = Math.round((exam.getTime() - cursor.getTime()) / DAY_MS);
    entries.push({
      daysBeforeExam,
      date: cursor,
      focusLabels: [],
      isExamDay: daysBeforeExam === 0,
    });
  }

  const studyDays = entries.filter((entry) => !entry.isExamDay);
  if (studyDays.length === 0) {
    entries[0]!.focusLabels = focusAreas.map((area) => area.label);
    return entries;
  }

  focusAreas.forEach((area, index) => {
    const targetDay = studyDays[index % studyDays.length]!;
    targetDay.focusLabels.push(area.label);
  });

  return entries;
}

export function formatRevisionCalendarSection(
  tutoringLanguage: TutoringLanguage,
  entries: RevisionCalendarEntry[],
): string {
  if (entries.length === 0) {
    return '';
  }

  const lang = resolveLanguage(tutoringLanguage);
  const title =
    lang === 'en'
      ? '## J-N revision calendar'
      : lang === 'de'
        ? '## J-N-Lernkalender'
        : '## Calendrier J-N';

  const lines = entries.map((entry) => formatRevisionCalendarLine(entry, lang));

  return [title, '', ...lines].join('\n');
}

function formatRevisionCalendarLine(
  entry: RevisionCalendarEntry,
  lang: 'fr' | 'en' | 'de',
): string {
  const label = `**J-${entry.daysBeforeExam}** (${formatCalendarDate(entry.date, lang)})`;
  if (entry.isExamDay) {
    return `${label} — ${examDayMessage(lang)}`;
  }

  const focusText =
    entry.focusLabels.length > 0
      ? entry.focusLabels.join(', ')
      : fallbackStudyMessage(lang);
  return `${label} — ${focusText} · ${studyHint(lang)}`;
}

function examDayMessage(lang: 'fr' | 'en' | 'de'): string {
  switch (lang) {
    case 'en':
      return 'Exam day: light review and rest.';
    case 'de':
      return 'Prüfungstag: leichte Wiederholung und ausruhen.';
    default:
      return 'Jour J : révision légère et repos.';
  }
}

function fallbackStudyMessage(lang: 'fr' | 'en' | 'de'): string {
  switch (lang) {
    case 'en':
      return 'General review';
    case 'de':
      return 'Allgemeine Wiederholung';
    default:
      return 'Révision générale';
  }
}

function studyHint(lang: 'fr' | 'en' | 'de'): string {
  switch (lang) {
    case 'en':
      return 'quiz or flashcards recommended';
    case 'de':
      return 'Quiz oder Karteikarten empfohlen';
    default:
      return 'quiz ou cartes recommandés';
  }
}

function formatCalendarDate(date: Date, lang: 'fr' | 'en' | 'de'): string {
  const locale = lang === 'en' ? 'en-GB' : lang === 'de' ? 'de-DE' : 'fr-FR';
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(date);
}

function resolveLanguage(language: TutoringLanguage): 'fr' | 'en' | 'de' {
  if (language === 'en' || language === 'de') {
    return language;
  }
  return 'fr';
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}
