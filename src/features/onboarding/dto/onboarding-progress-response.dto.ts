import type { LearnerProfile } from '../domain/learner-profile.enums';
import type { OnboardingTranscriptTurn } from '../domain/onboarding-transcript';
import { parseTranscript } from '../repositories/onboarding-user.store-helpers';
import type { OnboardingUserDocument } from '../repositories/onboarding-user.types';

export type OnboardingProgressResponseDto = {
  onboardingStatus: string;
  transcript: OnboardingTranscriptTurn[];
  pendingLearnerProfile?: LearnerProfile;
  pendingSummaryForUser?: string;
};

export const DEFAULT_ONBOARDING_PROGRESS_STATUS = 'not_started';

export function buildOnboardingProgressResponse(
  data: OnboardingUserDocument | Record<string, unknown>,
): OnboardingProgressResponseDto {
  const doc = data as OnboardingUserDocument;
  const transcript = parseTranscript(doc.onboardingTranscript);
  const onboardingStatus = resolveOnboardingStatus(doc, transcript);
  const pendingSummary = doc.pendingSummaryForUser;
  const pendingSummaryForUser =
    typeof pendingSummary === 'string' && pendingSummary.trim().length > 0
      ? pendingSummary.trim()
      : undefined;

  const response: OnboardingProgressResponseDto = {
    onboardingStatus,
    transcript,
  };

  if (doc.pendingLearnerProfile) {
    response.pendingLearnerProfile = doc.pendingLearnerProfile;
  }
  if (pendingSummaryForUser !== undefined) {
    response.pendingSummaryForUser = pendingSummaryForUser;
  }

  return response;
}

function resolveOnboardingStatus(
  doc: OnboardingUserDocument,
  transcript: OnboardingTranscriptTurn[],
): string {
  if (typeof doc.onboardingStatus === 'string' && doc.onboardingStatus.length > 0) {
    return doc.onboardingStatus;
  }
  if (transcript.length > 0) {
    return 'in_progress';
  }
  return DEFAULT_ONBOARDING_PROGRESS_STATUS;
}
