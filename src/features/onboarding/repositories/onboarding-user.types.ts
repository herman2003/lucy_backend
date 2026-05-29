import type { LearnerProfile } from '../domain/learner-profile.enums';
import type { OnboardingTranscriptTurn } from '../domain/onboarding-transcript';

export type ConfirmTurnParams = {
  locale: string;
  questionId: string;
  questionText: string;
  answerText: string;
};

export type ConfirmTurnResult = {
  onboardingStatus: string;
  completedTurns: number;
};

export type OnboardingUserState = {
  isConfigured: boolean;
  onboardingAttempts: Record<string, number>;
};

export type AnalyzeUserContext = {
  isConfigured: boolean;
  onboardingAnalyzeAttempts: number;
  transcript: OnboardingTranscriptTurn[];
};

export type OnboardingUserDocument = {
  fullName?: string;
  email?: string;
  createdAt?: string;
  uiLocale?: string;
  isConfigured?: boolean;
  onboardingAttempts?: Record<string, number>;
  onboardingAnalyzeAttempts?: number;
  onboardingTranscript?: OnboardingTranscriptTurn[];
  onboardingStatus?: string;
  pendingLearnerProfile?: LearnerProfile;
  pendingSummaryForUser?: string;
  tutoringLanguage?: string;
  learnerProfile?: LearnerProfile;
  onboardingCompletedAt?: string;
};
