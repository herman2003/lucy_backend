import type { RevisionCalendarEntry } from '../../learning-sessions/utils/revision-calendar.util';

export type BuildRevisionCalendarIcsInput = {
  calendarName: string;
  entries: RevisionCalendarEntry[];
  language: 'fr' | 'en' | 'de';
  generatedAt: Date;
  uidPrefix: string;
};

export function buildRevisionCalendarIcs(input: BuildRevisionCalendarIcsInput): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Lucy//Revision Calendar//EN',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escapeIcsText(input.calendarName)}`,
  ];

  for (const entry of input.entries) {
    lines.push(...buildEventLines(entry, input));
  }

  lines.push('END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}

function buildEventLines(
  entry: RevisionCalendarEntry,
  input: BuildRevisionCalendarIcsInput,
): string[] {
  const summary = buildEventSummary(entry, input.language);
  const description = buildEventDescription(entry, input.language);
  const uid = `${input.uidPrefix}-j${entry.daysBeforeExam}@lucy.app`;

  return [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatIcsDateTime(input.generatedAt)}`,
    `DTSTART;VALUE=DATE:${formatIcsDate(entry.date)}`,
    `SUMMARY:${escapeIcsText(summary)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    'END:VEVENT',
  ];
}

function buildEventSummary(
  entry: RevisionCalendarEntry,
  language: 'fr' | 'en' | 'de',
): string {
  const prefix = `J-${entry.daysBeforeExam}`;
  if (entry.isExamDay) {
    switch (language) {
      case 'en':
        return `${prefix} — Exam day`;
      case 'de':
        return `${prefix} — Prüfungstag`;
      default:
        return `${prefix} — Jour d'examen`;
    }
  }

  const focus =
    entry.focusLabels.length > 0
      ? entry.focusLabels.join(', ')
      : fallbackFocus(language);
  return `${prefix} — ${focus}`;
}

function buildEventDescription(
  entry: RevisionCalendarEntry,
  language: 'fr' | 'en' | 'de',
): string {
  if (entry.isExamDay) {
    switch (language) {
      case 'en':
        return 'Light review and rest.';
      case 'de':
        return 'Leichte Wiederholung und ausruhen.';
      default:
        return 'Révision légère et repos.';
    }
  }

  switch (language) {
    case 'en':
      return 'Quiz or flashcards recommended.';
    case 'de':
      return 'Quiz oder Karteikarten empfohlen.';
    default:
      return 'Quiz ou cartes recommandés.';
  }
}

function fallbackFocus(language: 'fr' | 'en' | 'de'): string {
  switch (language) {
    case 'en':
      return 'General review';
    case 'de':
      return 'Allgemeine Wiederholung';
    default:
      return 'Révision générale';
  }
}

function formatIcsDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function formatIcsDateTime(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}
