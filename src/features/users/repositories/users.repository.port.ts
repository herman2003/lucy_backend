import type { LearnerProfile } from '../../onboarding/domain/learner-profile.enums';

export const USERS_PROFILE_REPOSITORY = Symbol('USERS_PROFILE_REPOSITORY');

export type UpsertUserProfileInput = {
  fullName: string;
  email: string;
  uiLocale?: string;
};

export type UpdateUserProfilePatch = {
  fullName?: string;
  uiLocale?: string;
};

export type UpsertUserProfileResult = {
  created: boolean;
  profile: Record<string, unknown>;
};

export interface UsersProfileRepository {
  getProfile(uid: string): Promise<Record<string, unknown> | null>;
  upsertProfile(
    uid: string,
    input: UpsertUserProfileInput,
  ): Promise<UpsertUserProfileResult>;
  updateLearnerProfile(
    uid: string,
    learnerProfile: LearnerProfile,
  ): Promise<Record<string, unknown>>;
  updateProfile(
    uid: string,
    patch: UpdateUserProfilePatch,
  ): Promise<Record<string, unknown>>;
}
