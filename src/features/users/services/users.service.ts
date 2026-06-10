import { Inject, Injectable } from '@nestjs/common';

import { LucyErrorCodes } from '../../../core/errors/lucy-error-codes';
import { LucyApiError } from '../../../core/errors/lucy-api.error';
import { parseCreateUserProfileRequest } from '../dto/create-user-profile.dto';
import { parseUpdateLearnerProfileRequest } from '../dto/update-learner-profile.dto';
import { parseUpdateUserProfileRequest } from '../dto/update-user-profile.dto';
import {
  buildUserProfileResponse,
  type UserProfileResponseDto,
} from '../dto/user-profile-response.dto';
import {
  USERS_PROFILE_REPOSITORY,
  type UsersProfileRepository,
} from '../repositories/users.repository.port';

export type CreateUserProfileResult = {
  created: boolean;
  profile: UserProfileResponseDto;
};

@Injectable()
export class UsersService {
  constructor(
    @Inject(USERS_PROFILE_REPOSITORY)
    private readonly usersRepository: UsersProfileRepository,
  ) {}

  async getMe(uid: string): Promise<UserProfileResponseDto> {
    const data = await this.usersRepository.getProfile(uid);
    return buildUserProfileResponse(uid, data ?? {});
  }

  async createMe(uid: string, body: unknown): Promise<CreateUserProfileResult> {
    const input = parseCreateUserProfileRequest(body);

    try {
      const result = await this.usersRepository.upsertProfile(uid, input);
      return {
        created: result.created,
        profile: buildUserProfileResponse(uid, result.profile),
      };
    } catch (error) {
      if (error instanceof Error && error.message === 'USER_PROFILE_CONFLICT') {
        throw new LucyApiError(
          409,
          LucyErrorCodes.USER_PROFILE_CONFLICT,
          'User profile email conflict',
        );
      }
      throw error;
    }
  }

  async updateMe(uid: string, body: unknown): Promise<UserProfileResponseDto> {
    const patch = parseUpdateUserProfileRequest(body);
    const existing = await this.usersRepository.getProfile(uid);
    if (!existing || typeof existing.fullName !== 'string' || !existing.fullName) {
      throw new LucyApiError(
        404,
        LucyErrorCodes.VALIDATION_ERROR,
        'User profile not found',
      );
    }

    const updated = await this.usersRepository.updateProfile(uid, patch);
    return buildUserProfileResponse(uid, updated);
  }

  async updateLearnerProfile(
    uid: string,
    body: unknown,
  ): Promise<UserProfileResponseDto> {
    const learnerProfile = parseUpdateLearnerProfileRequest(body);
    const existing = await this.usersRepository.getProfile(uid);
    if (!existing || typeof existing.fullName !== 'string' || !existing.fullName) {
      throw new LucyApiError(
        404,
        LucyErrorCodes.VALIDATION_ERROR,
        'User profile not found',
      );
    }
    if (existing.learnerProfile === undefined || existing.learnerProfile === null) {
      throw new LucyApiError(
        400,
        LucyErrorCodes.ONBOARDING_PROFILE_INCOMPLETE,
        'Learner profile is missing',
      );
    }

    const updated = await this.usersRepository.updateLearnerProfile(
      uid,
      learnerProfile,
    );
    return buildUserProfileResponse(uid, updated);
  }
}
