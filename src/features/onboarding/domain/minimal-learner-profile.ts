import type { LearnerProfile } from './learner-profile.enums';

/** Placeholder profile when analyze falls back after max attempts (SPEC §4.6). */
export function buildMinimalLearnerProfile(locale: string): LearnerProfile {
  const tutoring_language =
    locale === 'de' ? 'de' : locale === 'en' ? 'en' : 'fr';

  return {
    primary_role: 'other',
    main_domains: ['other'],
    learning_goal: 'other',
    self_assessed_level: 'variable',
    explanation_style: 'step_by_step',
    feedback_tone: 'encouraging',
    tutoring_language,
  };
}
