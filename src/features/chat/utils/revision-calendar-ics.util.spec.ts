import type { RevisionCalendarEntry } from '../../learning-sessions/utils/revision-calendar.util';
import { buildRevisionCalendarIcs } from './revision-calendar-ics.util';

describe('buildRevisionCalendarIcs (LEARN-12a-V3)', () => {
  const entries: RevisionCalendarEntry[] = [
    {
      daysBeforeExam: 2,
      date: new Date('2026-06-11T00:00:00.000Z'),
      focusLabels: ['Entropie', 'ΔS'],
      isExamDay: false,
    },
    {
      daysBeforeExam: 0,
      date: new Date('2026-06-13T00:00:00.000Z'),
      focusLabels: [],
      isExamDay: true,
    },
  ];

  it('builds a valid VCALENDAR with one VEVENT per study day', () => {
    const ics = buildRevisionCalendarIcs({
      calendarName: 'Thermo partiel',
      entries,
      language: 'fr',
      generatedAt: new Date('2026-06-10T10:00:00.000Z'),
      uidPrefix: 'chat-abc',
    });

    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('VERSION:2.0');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('DTSTART;VALUE=DATE:20260611');
    expect(ics).toContain('SUMMARY:');
    expect(ics).toContain('Entropie');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics.match(/BEGIN:VEVENT/g)?.length).toBe(2);
  });
});
