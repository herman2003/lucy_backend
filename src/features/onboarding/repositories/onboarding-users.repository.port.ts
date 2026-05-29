import type {
  AnalyzeUserContext,
  ConfirmTurnParams,
  ConfirmTurnResult,
  OnboardingUserState,
} from './onboarding-user.types';
import type { OnboardingProgressResponseDto } from '../dto/onboarding-progress-response.dto';
import type { LearnerProfile } from '../domain/learner-profile.enums';

export const ONBOARDING_USERS_REPOSITORY = Symbol('ONBOARDING_USERS_REPOSITORY');

export interface OnboardingUsersRepository {
  getOnboardingState(uid: string): Promise<OnboardingUserState>;
  getAnalyzeContext(uid: string): Promise<AnalyzeUserContext>;
  getProgress(uid: string): Promise<OnboardingProgressResponseDto>;
  incrementValidateAttempt(uid: string, questionId: string): Promise<number>;
  incrementAnalyzeAttempts(uid: string): Promise<number>;
  confirmTurn(uid: string, params: ConfirmTurnParams): Promise<ConfirmTurnResult>;
  saveAnalyzeSuccess(
    uid: string,
    learnerProfile: LearnerProfile,
    summaryForUser: string,
  ): Promise<void>;
  finalizeOnboarding(uid: string): Promise<void>;
}
