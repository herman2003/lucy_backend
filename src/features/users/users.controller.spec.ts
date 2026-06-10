import { Test, TestingModule } from '@nestjs/testing';

import { FirebaseAuthGuard } from '../../core/auth/firebase-auth.guard';
import { FirebaseAuthService } from '../../core/auth/firebase-auth.service';
import { LUCY_CONFIG } from '../../core/config/app-config.module';
import { loadLucyConfig } from '../../core/config/lucy-config';
import { InMemoryUsersStore } from '../../core/persistence/in-memory-users.store';
import { InMemoryUsersProfileRepository } from './repositories/in-memory-users-profile.repository';
import { USERS_PROFILE_REPOSITORY } from './repositories/users.repository.port';
import { UsersController } from './users.controller';
import { UsersService } from './services/users.service';

describe('UsersController', () => {
  let controller: UsersController;
  const uid = 'dev-user-1';

  beforeEach(async () => {
    const store = new InMemoryUsersStore();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        UsersService,
        {
          provide: USERS_PROFILE_REPOSITORY,
          useValue: new InMemoryUsersProfileRepository(store),
        },
        {
          provide: FirebaseAuthService,
          useValue: {
            verifyIdToken: jest.fn().mockResolvedValue({ uid }),
          },
        },
        {
          provide: LUCY_CONFIG,
          useValue: loadLucyConfig({
            NODE_ENV: 'development',
            LLM_PROVIDER: 'mock',
            FIREBASE_AUTH_MODE: 'dev',
            FIRESTORE_PROVIDER: 'memory',
          }),
        },
      ],
    })
      .overrideGuard(FirebaseAuthGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => { getRequest: () => { user?: { uid: string } } };
        }) => {
          const request = context.switchToHttp().getRequest();
          request.user = { uid };
          return true;
        },
      })
      .compile();

    controller = module.get(UsersController);
  });

  it('POST /users/me returns 201 then 200 on duplicate', async () => {
    const response = { status: jest.fn() };
    const created = await controller.createMe(
      { user: { uid } } as never,
      {
        fullName: 'Jane Doe',
        email: 'jane@example.com',
      },
      response as never,
    );

    expect(response.status).toHaveBeenCalledWith(201);
    expect(created.fullName).toBe('Jane Doe');

    const response2 = { status: jest.fn() };
    await controller.createMe(
      { user: { uid } } as never,
      {
        fullName: 'Jane Doe',
        email: 'jane@example.com',
      },
      response2 as never,
    );
    expect(response2.status).toHaveBeenCalledWith(200);
  });

  it('GET /users/me returns persisted profile', async () => {
    const response = { status: jest.fn() };
    await controller.createMe(
      { user: { uid } } as never,
      {
        fullName: 'Jane Doe',
        email: 'jane@example.com',
      },
      response as never,
    );

    const profile = await controller.getMe({ user: { uid } } as never);
    expect(profile.email).toBe('jane@example.com');
  });
});
