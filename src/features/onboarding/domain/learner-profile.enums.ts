/** SPEC §4.4.1 — learnerProfile enum values. */
export const PRIMARY_ROLES = [
  'student',
  'professional',
  'educator',
  'self_learner',
  'other',
] as const;

export const MAIN_DOMAINS = [
  'sciences',
  'law',
  'medicine',
  'languages',
  'business',
  'cs',
  'other',
] as const;

export const LEARNING_GOALS = [
  'exam',
  'understand_course',
  'quick_review',
  'professional',
  'certification',
  'other',
] as const;

export const SELF_ASSESSED_LEVELS = [
  'beginner',
  'intermediate',
  'advanced',
  'variable',
] as const;

export const EXPLANATION_STYLES = [
  'step_by_step',
  'summary_first',
  'analogies',
  'socratic',
] as const;

export const FEEDBACK_TONES = ['encouraging', 'neutral', 'strict'] as const;

export const TUTORING_LANGUAGES = ['fr', 'en', 'de', 'match_document'] as const;

export type PrimaryRole = (typeof PRIMARY_ROLES)[number];
export type MainDomain = (typeof MAIN_DOMAINS)[number];
export type LearningGoal = (typeof LEARNING_GOALS)[number];
export type SelfAssessedLevel = (typeof SELF_ASSESSED_LEVELS)[number];
export type ExplanationStyle = (typeof EXPLANATION_STYLES)[number];
export type FeedbackTone = (typeof FEEDBACK_TONES)[number];
export type TutoringLanguage = (typeof TUTORING_LANGUAGES)[number];

export type LearnerProfile = {
  primary_role: PrimaryRole;
  main_domains: MainDomain[];
  learning_goal: LearningGoal;
  self_assessed_level: SelfAssessedLevel;
  explanation_style: ExplanationStyle;
  feedback_tone: FeedbackTone;
  tutoring_language: TutoringLanguage;
};
