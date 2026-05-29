import { Test, TestingModule } from '@nestjs/testing';

import { FirebaseAuthGuard } from '../../../core/auth/firebase-auth.guard';
import { FirebaseAuthService } from '../../../core/auth/firebase-auth.service';
import { LUCY_CONFIG } from '../../../core/config/app-config.module';
import { loadLucyConfig } from '../../../core/config/lucy-config';
import { createInMemoryOnboardingUsersRepository } from '../repositories/in-memory-onboarding-user.repository';
import { ONBOARDING_USERS_REPOSITORY } from '../repositories/onboarding-users.repository.port';
import { OnboardingController } from '../onboarding.controller';
import { OnboardingQuestionCatalog } from '../questions/onboarding-question.catalog';
import { OnboardingService } from '../services/onboarding.service';
import { PromptLoaderService } from '../../../core/prompt/prompt-loader.service';
import { LLM_PORT } from '../../../core/llm/llm.tokens';
import { MockLlmAdapter } from '../../../core/llm/mock.llm.adapter';

describe('OnboardingController GET /progress', () => {
  let controller: OnboardingController;
  let users: ReturnType<typeof createInMemoryOnboardingUsersRepository>;
  const uid = 'dev-user-progress';

  beforeEach(async () => {
    users = createInMemoryOnboardingUsersRepository();
    await users.confirmTurn(uid, {
      locale: 'fr',
      questionId: 'q_role',
      questionText: 'Role?',
      answerText: 'Student',
    });

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OnboardingController],
      providers: [
        OnboardingService,
        PromptLoaderService,
        OnboardingQuestionCatalog,
        { provide: LLM_PORT, useClass: MockLlmAdapter },
        {
          provide: ONBOARDING_USERS_REPOSITORY,
          useValue: users,
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

    controller = module.get(OnboardingController);
  });

  it('returns transcript and onboardingStatus for authenticated user', async () => {
    const progress = await controller.getProgress({ user: { uid } } as never);

    expect(progress.onboardingStatus).toBe('in_progress');
    expect(progress.transcript).toHaveLength(1);
    expect(progress.transcript[0]?.questionId).toBe('q_role');
  });

  it('returns not_started when user has no onboarding data', async () => {
    const progress = await controller.getProgress({
      user: { uid: 'fresh-user' },
    } as never);

    expect(progress).toEqual({
      onboardingStatus: 'not_started',
      transcript: [],
    });
  });
});
