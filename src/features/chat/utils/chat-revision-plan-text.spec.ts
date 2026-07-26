import { buildRevisionPlanText } from './chat-learning-dialogue-messages';
import type { CorpusStudyPlan } from '../../learning-sessions/domain/study-focus-area.types';

const samplePlan: CorpusStudyPlan = {
  generatedAt: '2026-06-10T12:00:00.000Z',
  expiresAt: '2026-06-11T12:00:00.000Z',
  focusAreas: [
    {
      id: 'focus_1',
      documentId: 'doc_1',
      documentTitle: 'Thermo',
      label: 'Entropie',
      pageStart: 1,
      pageEnd: 3,
      ordinalStart: 0,
      ordinalEnd: 0,
      importance: 'high',
      rationale: 'Concept central du chapitre.',
      keyConcepts: ['entropie', 'second principe'],
    },
  ],
};

describe('buildRevisionPlanText (LEARN-10c)', () => {
  it('formats a copyable markdown revision plan in French', () => {
    const text = buildRevisionPlanText('fr', samplePlan);
    expect(text).toContain('## Plan de révision');
    expect(text).toContain('1. **Entropie**');
    expect(text).toContain('priorité haute');
    expect(text).toContain('quiz');
  });

  it('mentions exam type when provided', () => {
    const text = buildRevisionPlanText('fr', samplePlan, { examType: 'partiel' });
    expect(text).toContain('**partiel**');
  });

  it('formats in English', () => {
    const text = buildRevisionPlanText('en', samplePlan);
    expect(text).toContain('## Revision plan');
    expect(text).toContain('high priority');
    expect(text).toContain('flashcards');
  });

  it('appends a J-N calendar when an exam date is provided (LEARN-11d)', () => {
    const text = buildRevisionPlanText('fr', samplePlan, {
      examType: 'partiel',
      examDate: new Date('2026-06-17T00:00:00.000Z'),
      now: new Date('2026-06-10T12:00:00.000Z'),
    });

    expect(text).toContain('## Calendrier J-N');
    expect(text).toContain('**J-7');
    expect(text).toContain('**J-0');
  });
});
