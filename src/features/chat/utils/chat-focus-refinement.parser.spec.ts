import {
  buildFocusRefinementHint,
  parseFocusRefinementRequest,
} from './chat-focus-refinement.parser';

describe('chat-focus-refinement.parser', () => {
  it('detects a full re-analysis request', () => {
    expect(parseFocusRefinementRequest('autre proposition')).toEqual({
      kind: 'reanalyze',
    });
    expect(parseFocusRefinementRequest('andere Vorschläge bitte')).toEqual({
      kind: 'reanalyze',
    });
  });

  it('detects a targeted refinement hint', () => {
    expect(parseFocusRefinementRequest('plus sur la Bachelorarbeit')).toEqual({
      kind: 'refine',
      hint: 'plus sur la Bachelorarbeit',
    });
    expect(parseFocusRefinementRequest('focus on chapter 3')).toEqual({
      kind: 'refine',
      hint: 'focus on chapter 3',
    });
  });

  it('returns none for normal selection messages', () => {
    expect(parseFocusRefinementRequest('1 et 2')).toEqual({ kind: 'none' });
    expect(parseFocusRefinementRequest('tout')).toEqual({ kind: 'none' });
  });

  it('builds a default hint for re-analysis', () => {
    expect(
      buildFocusRefinementHint({
        kind: 'reanalyze',
      }),
    ).toContain('different study focus recommendations');
  });
});
