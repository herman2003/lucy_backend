import type { StudyFocusArea } from '../domain/study-focus-area.types';
import { buildRevisionCalendarEntries, formatRevisionCalendarSection } from './revision-calendar.util';

const focusAreas: StudyFocusArea[] = [
  {
    id: 'focus_1',
    documentId: 'doc_1',
    documentTitle: 'Thermo',
    label: 'Entropie',
    ordinalStart: 0,
    ordinalEnd: 0,
    importance: 'high',
    rationale: 'Base.',
    keyConcepts: ['entropie'],
  },
  {
    id: 'focus_2',
    documentId: 'doc_1',
    documentTitle: 'Thermo',
    label: 'Enthalpie',
    ordinalStart: 1,
    ordinalEnd: 1,
    importance: 'medium',
    rationale: 'Suite.',
    keyConcepts: ['enthalpie'],
  },
];

describe('revision-calendar.util (LEARN-11d)', () => {
  const now = new Date('2026-06-10T12:00:00.000Z');
  const examDate = new Date('2026-06-13T00:00:00.000Z');

  it('distributes focus areas across study days before exam day', () => {
    const entries = buildRevisionCalendarEntries(focusAreas, examDate, now);

    expect(entries).toHaveLength(4);
    expect(entries[0]?.daysBeforeExam).toBe(3);
    expect(entries[3]?.isExamDay).toBe(true);
    expect(entries.some((entry) => entry.focusLabels.includes('Entropie'))).toBe(true);
  });

  it('formats a J-N calendar section in French', () => {
    const entries = buildRevisionCalendarEntries(focusAreas, examDate, now);
    const section = formatRevisionCalendarSection('fr', entries);

    expect(section).toContain('## Calendrier J-N');
    expect(section).toContain('**J-3');
    expect(section).toContain('**J-0');
  });
});
