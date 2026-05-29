import { Inject, Injectable } from '@nestjs/common';

import { LucyErrorCodes } from '../../../core/errors/lucy-error-codes';
import { LucyApiError } from '../../../core/errors/lucy-api.error';
import { parseCreateUserProfileRequest } from '../dto/create-user-profile.dto';
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
}
