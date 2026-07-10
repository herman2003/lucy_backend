import { clampOrdinalRangeToKnown } from './corpus-study-ordinal.util';

describe('corpus-study-ordinal.util', () => {
  it('keeps overlapping ordinal ranges unchanged', () => {
    expect(clampOrdinalRangeToKnown(0, 2, new Set([0, 1, 3]))).toEqual({
      ordinalStart: 0,
      ordinalEnd: 1,
    });
  });

  it('clamps non-overlapping ranges to the nearest known ordinal', () => {
    expect(clampOrdinalRangeToKnown(1, 2, new Set([0, 3, 7]))).toEqual({
      ordinalStart: 0,
      ordinalEnd: 0,
    });
  });
});
