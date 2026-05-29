export const USERS_PROFILE_REPOSITORY = Symbol('USERS_PROFILE_REPOSITORY');

export type UpsertUserProfileInput = {
  fullName: string;
  email: string;
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
}
