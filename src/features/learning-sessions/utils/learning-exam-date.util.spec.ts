import { detectLearningExamDate } from './learning-exam-date.util';

describe('detectLearningExamDate (LEARN-11d)', () => {
  const reference = new Date('2026-06-10T12:00:00.000Z');

  it('parses French absolute dates', () => {
    expect(
      detectLearningExamDate('plan de révision pour le 20 juin', reference)?.toISOString(),
    ).toBe('2026-06-20T00:00:00.000Z');
  });

  it('parses relative French day offsets', () => {
    expect(
      detectLearningExamDate('calendrier dans 7 jours', reference)?.toISOString(),
    ).toBe('2026-06-17T00:00:00.000Z');
  });

  it('parses English month-day dates', () => {
    expect(
      detectLearningExamDate('revision plan for june 20', reference)?.toISOString(),
    ).toBe('2026-06-20T00:00:00.000Z');
  });

  it('returns undefined when no exam date is mentioned', () => {
    expect(detectLearningExamDate('fais-moi un quiz', reference)).toBeUndefined();
  });
});
