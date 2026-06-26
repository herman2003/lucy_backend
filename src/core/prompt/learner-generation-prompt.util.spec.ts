import { buildDifficultyGuidance } from './learner-generation-prompt.util';

describe('buildDifficultyGuidance (LEARN-07e)', () => {
  it('returns beginner-friendly guidance', () => {
    expect(buildDifficultyGuidance('beginner').toLowerCase()).toContain('foundational');
  });

  it('returns advanced guidance with deeper reasoning', () => {
    expect(buildDifficultyGuidance('advanced').toLowerCase()).toContain('nuanced');
  });
});
