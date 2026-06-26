import type { StudyFocusArea } from '../domain/study-focus-area.types';
import { buildLearningSessionTitle } from './learning-session-title.util';

const focusArea = (label: string, id = 'focus_1'): StudyFocusArea => ({
  id,
  documentId: 'doc_1',
  documentTitle: 'Thermo',
  label,
  ordinalStart: 0,
  ordinalEnd: 0,
  importance: 'high',
  rationale: 'Important.',
  keyConcepts: ['concept'],
});

describe('buildLearningSessionTitle (LEARN-09a)', () => {
  it('falls back to the date when no subject is available', () => {
    expect(
      buildLearningSessionTitle({
        type: 'quiz',
        isoTimestamp: '2026-06-10T12:00:00.000Z',
      }),
    ).toBe('Quiz · 2026-06-10');
  });

  it('uses topicHint when focus areas are absent', () => {
    expect(
      buildLearningSessionTitle({
        type: 'flashcards',
        isoTimestamp: '2026-06-10T12:00:00.000Z',
        topicHint: '  entropie  ',
      }),
    ).toBe('Cartes · entropie');
  });

  it('uses a single focus area label for professor mode', () => {
    expect(
      buildLearningSessionTitle({
        type: 'quiz',
        isoTimestamp: '2026-06-10T12:00:00.000Z',
        focusAreas: [focusArea('Entropie')],
      }),
    ).toBe('Quiz · Entropie');
  });

  it('joins two focus area labels', () => {
    expect(
      buildLearningSessionTitle({
        type: 'quiz',
        isoTimestamp: '2026-06-10T12:00:00.000Z',
        focusAreas: [
          focusArea('Entropie', 'focus_1'),
          focusArea('Enthalpie', 'focus_2'),
        ],
      }),
    ).toBe('Quiz · Entropie, Enthalpie');
  });

  it('summarizes three or more focus areas with a counter', () => {
    expect(
      buildLearningSessionTitle({
        type: 'flashcards',
        isoTimestamp: '2026-06-10T12:00:00.000Z',
        focusAreas: [
          focusArea('Entropie', 'focus_1'),
          focusArea('Enthalpie', 'focus_2'),
          focusArea('Équilibre', 'focus_3'),
        ],
      }),
    ).toBe('Cartes · Entropie +2');
  });

  it('prefers focus areas over topicHint', () => {
    expect(
      buildLearningSessionTitle({
        type: 'quiz',
        isoTimestamp: '2026-06-10T12:00:00.000Z',
        topicHint: 'thermodynamique',
        focusAreas: [focusArea('Entropie')],
      }),
    ).toBe('Quiz · Entropie');
  });

  it('truncates long subjects', () => {
    const longLabel = 'A'.repeat(80);

    expect(
      buildLearningSessionTitle({
        type: 'quiz',
        isoTimestamp: '2026-06-10T12:00:00.000Z',
        focusAreas: [focusArea(longLabel)],
      }),
    ).toHaveLength('Quiz · '.length + 48);
    expect(
      buildLearningSessionTitle({
        type: 'quiz',
        isoTimestamp: '2026-06-10T12:00:00.000Z',
        focusAreas: [focusArea(longLabel)],
      }).endsWith('…'),
    ).toBe(true);
  });
});
