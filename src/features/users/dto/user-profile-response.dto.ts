import type { LearnerProfile } from '../../onboarding/domain/learner-profile.enums';
import { parseLearnerProfile } from '../../onboarding/validators/analyze-response.validator';

export type UserProfileResponseDto = {
  uid: string;
  fullName: string;
  email: string;
  createdAt: string;
  isConfigured: boolean;
  onboardingStatus: string;
  uiLocale?: string;
  learnerProfile?: LearnerProfile;
};

export const DEFAULT_ONBOARDING_STATUS = 'not_started';

export function buildUserProfileResponse(
  uid: string,
  data: Record<string, unknown>,
): UserProfileResponseDto {
  const fullName = typeof data.fullName === 'string' ? data.fullName : '';
  const email = typeof data.email === 'string' ? data.email : '';
  const createdAt =
    typeof data.createdAt === 'string'
      ? data.createdAt
      : new Date(0).toISOString();
  const onboardingStatus =
    typeof data.onboardingStatus === 'string'
      ? data.onboardingStatus
      : DEFAULT_ONBOARDING_STATUS;
  const uiLocale =
    typeof data.uiLocale === 'string' ? data.uiLocale : undefined;
  const learnerProfile = tryParseStoredLearnerProfile(data.learnerProfile);

  return {
    uid,
    fullName,
    email,
    createdAt,
    isConfigured: data.isConfigured === true,
    onboardingStatus,
    ...(uiLocale !== undefined ? { uiLocale } : {}),
    ...(learnerProfile !== undefined ? { learnerProfile } : {}),
  };
}

function tryParseStoredLearnerProfile(value: unknown): LearnerProfile | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  try {
    return parseLearnerProfile(value);
  } catch {
    return undefined;
  }
}
