import { parseGeneratedCorpusStudyPlan } from './generated-corpus-study-plan.validator';

describe('generated-corpus-study-plan.validator (LEARN-07a)', () => {
  const context = {
    documentsById: new Map([['doc_1', { title: 'Thermo' }]]),
    ordinalsByDocumentId: new Map([['doc_1', new Set([0, 1])]]),
  };

  it('parses valid focus areas', () => {
    const areas = parseGeneratedCorpusStudyPlan(
      {
        focusAreas: [
          {
            id: 'focus_1',
            documentId: 'doc_1',
            label: 'Chapitre 1',
            ordinalStart: 0,
            ordinalEnd: 1,
            importance: 'high',
            rationale: 'Base du cours.',
            keyConcepts: ['entropie'],
          },
        ],
      },
      context,
    );

    expect(areas).toHaveLength(1);
    expect(areas[0]?.documentTitle).toBe('Thermo');
  });

  it('rejects unknown documentId', () => {
    expect(() =>
      parseGeneratedCorpusStudyPlan(
        {
          focusAreas: [
            {
              documentId: 'missing',
              label: 'X',
              ordinalStart: 0,
              ordinalEnd: 0,
              importance: 'high',
              rationale: 'R',
              keyConcepts: ['a'],
            },
          ],
        },
        context,
      ),
    ).toThrow(/unknown documentId/);
  });

  it('clamps invalid ordinal ranges to known excerpts', () => {
    const areas = parseGeneratedCorpusStudyPlan(
      {
        focusAreas: [
          {
            documentId: 'doc_1',
            label: 'Chapitre 2',
            ordinalStart: 5,
            ordinalEnd: 8,
            importance: 'medium',
            rationale: 'Section avancée.',
            keyConcepts: ['thermo'],
          },
        ],
      },
      context,
    );

    expect(areas[0]).toMatchObject({
      ordinalStart: 1,
      ordinalEnd: 1,
    });
  });
});
