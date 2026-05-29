import { LucyErrorCodes } from '../../../core/errors/lucy-error-codes';
import { LucyApiError } from '../../../core/errors/lucy-api.error';
import { InMemoryUsersProfileRepository } from '../repositories/in-memory-users-profile.repository';
import { UsersService } from './users.service';
import { InMemoryUsersStore } from '../../../core/persistence/in-memory-users.store';

describe('UsersService', () => {
  const uid = 'user-1';
  let store: InMemoryUsersStore;
  let service: UsersService;

  beforeEach(() => {
    store = new InMemoryUsersStore();
    service = new UsersService(new InMemoryUsersProfileRepository(store));
  });

  it('getMe returns defaults when profile is missing', async () => {
    const profile = await service.getMe(uid);

    expect(profile).toMatchObject({
      uid,
      fullName: '',
      email: '',
      isConfigured: false,
      onboardingStatus: 'not_started',
    });
  });

  it('createMe creates profile with isConfigured false', async () => {
    const result = await service.createMe(uid, {
      fullName: 'Jane Doe',
      email: 'jane@example.com',
      uiLocale: 'fr',
    });

    expect(result.created).toBe(true);
    expect(result.profile).toMatchObject({
      uid,
      fullName: 'Jane Doe',
      email: 'jane@example.com',
      isConfigured: false,
      onboardingStatus: 'not_started',
      uiLocale: 'fr',
    });
  });

  it('createMe is idempotent when profile already exists', async () => {
    await service.createMe(uid, {
      fullName: 'Jane Doe',
      email: 'jane@example.com',
    });

    const result = await service.createMe(uid, {
      fullName: 'Other Name',
      email: 'jane@example.com',
      uiLocale: 'en',
    });

    expect(result.created).toBe(false);
    expect(result.profile.fullName).toBe('Jane Doe');
    expect(result.profile.uiLocale).toBe('en');
  });

  it('createMe throws USER_PROFILE_CONFLICT when email differs', async () => {
    await service.createMe(uid, {
      fullName: 'Jane Doe',
      email: 'jane@example.com',
    });

    await expect(
      service.createMe(uid, {
        fullName: 'Jane Doe',
        email: 'other@example.com',
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      error: LucyErrorCodes.USER_PROFILE_CONFLICT,
    } satisfies Partial<LucyApiError>);
  });

  it('createMe rejects invalid body', async () => {
    await expect(service.createMe(uid, {})).rejects.toMatchObject({
      statusCode: 400,
      error: LucyErrorCodes.VALIDATION_ERROR,
    });
  });
});
