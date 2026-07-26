import type { SearchRetrievalHitDto } from '../../retrieval/dto/search-retrieval.dto';
import type { StudyFocusArea } from '../domain/study-focus-area.types';
import {
  buildFocusScopedRetrievalQuery,
  documentIdsFromFocusAreas,
  filterHitsByFocusAreas,
  resolveSelectedFocusAreas,
} from './focus-scoped-retrieval';

const focusAreas: StudyFocusArea[] = [
  {
    id: 'focus_1',
    documentId: 'doc_a',
    documentTitle: 'Thermo',
    label: 'Entropie',
    ordinalStart: 0,
    ordinalEnd: 1,
    importance: 'high',
    rationale: 'Base.',
    keyConcepts: ['entropie'],
  },
  {
    id: 'focus_2',
    documentId: 'doc_b',
    documentTitle: 'Chimie',
    label: 'Enthalpie',
    ordinalStart: 2,
    ordinalEnd: 3,
    importance: 'medium',
    rationale: 'Suite.',
    keyConcepts: ['enthalpie'],
  },
];

function hit(
  chunkId: string,
  documentId: string,
  text = 'excerpt',
): SearchRetrievalHitDto {
  return {
    documentId,
    title: 'Doc',
    chunkId,
    text,
    score: 0.9,
    contextHeader: text,
  };
}

describe('focus-scoped-retrieval (LEARN-07d)', () => {
  it('filters hits to selected focus ordinal ranges per document', () => {
    const hits = [
      hit('chunk_0', 'doc_a', 'entropie'),
      hit('chunk_2', 'doc_a', 'hors zone'),
      hit('chunk_2', 'doc_b', 'enthalpie'),
      hit('chunk_5', 'doc_b', 'trop loin'),
    ];

    expect(filterHitsByFocusAreas(hits, focusAreas)).toEqual([
      hit('chunk_0', 'doc_a', 'entropie'),
      hit('chunk_2', 'doc_b', 'enthalpie'),
    ]);
  });

  it('extracts unique document ids from focus areas', () => {
    expect(documentIdsFromFocusAreas(focusAreas)).toEqual(['doc_a', 'doc_b']);
  });

  it('builds retrieval query from focus labels, concepts, and topic hint', () => {
    expect(
      buildFocusScopedRetrievalQuery('quiz', [focusAreas[0]!], 'thermodynamique'),
    ).toContain('entropie');
    expect(
      buildFocusScopedRetrievalQuery('quiz', [focusAreas[0]!], 'thermodynamique'),
    ).toContain('thermodynamique');
  });

  it('resolves selected focus areas from corpus plan', () => {
    const plan = {
      generatedAt: '2026-06-10T00:00:00.000Z',
      expiresAt: '2026-06-11T00:00:00.000Z',
      focusAreas,
    };

    expect(resolveSelectedFocusAreas(plan, ['focus_2'])).toEqual([focusAreas[1]]);
    expect(resolveSelectedFocusAreas(plan, ['focus_1', 'focus_2'])).toEqual(
      focusAreas,
    );
    expect(resolveSelectedFocusAreas(plan, undefined)).toEqual([]);
  });
});
