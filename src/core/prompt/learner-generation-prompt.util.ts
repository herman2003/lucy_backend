import type { SelfAssessedLevel } from '../../features/onboarding/domain/learner-profile.enums';

export function buildDifficultyGuidance(level: SelfAssessedLevel): string {
  switch (level) {
    case 'beginner':
      return [
        'Target beginner-friendly difficulty:',
        'prefer foundational recall, clear wording, and simple applications;',
        'avoid trick questions or multi-step inference beyond the excerpts.',
      ].join(' ');
    case 'intermediate':
      return [
        'Target intermediate difficulty:',
        'balance definitions with application and light synthesis across excerpts;',
        'keep distractors plausible but fair.',
      ].join(' ');
    case 'advanced':
      return [
        'Target advanced difficulty:',
        'include nuanced distinctions, edge cases, and deeper reasoning grounded in the excerpts;',
        'avoid trivial recall-only items.',
      ].join(' ');
    case 'variable':
      return [
        'Target mixed difficulty:',
        'include a spread from accessible recall to more demanding application within the excerpts.',
      ].join(' ');
    default: {
      const exhaustive: never = level;
      return exhaustive;
    }
  }
}
