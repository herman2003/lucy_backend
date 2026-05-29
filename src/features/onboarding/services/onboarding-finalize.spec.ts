import { Test } from '@nestjs/testing';

import { LucyErrorCodes } from '../../../core/errors/lucy-error-codes';
import { LLM_PORT } from '../../../core/llm/llm.tokens';
import { PromptLoaderService } from '../../../core/prompt/prompt-loader.service';
import { ONBOARDING_USERS_REPOSITORY } from '../repositories/onboarding-users.repository.port';
import { OnboardingQuestionCatalog } from '../questions/onboarding-question.catalog';
import { OnboardingService } from './onboarding.service';

describe('OnboardingService.finalize', () => {
  let service: OnboardingService;
  let usersRepo: {
    getOnboardingState: jest.Mock;
    finalizeOnboarding: jest.Mock;
  };

  beforeEach(async () => {
    usersRepo = {
      getOnboardingState: jest.fn().mockResolvedValue({
        isConfigured: false,
        onboardingAttempts: {},
      }),
      finalizeOnboarding: jest.fn().mockResolvedValue(undefined),
    };

    const module = await Test.createTestingModule({
      providers: [
        OnboardingService,
        PromptLoaderService,
        OnboardingQuestionCatalog,
        { provide: LLM_PORT, useValue: { generateStructured: jest.fn() } },
        {
          provide: ONBOARDING_USERS_REPOSITORY,
          useValue: {
            getOnboardingState: usersRepo.getOnboardingState,
            getAnalyzeContext: jest.fn(),
            confirmTurn: jest.fn(),
            incrementAnalyzeAttempts: jest.fn(),
            saveAnalyzeSuccess: jest.fn(),
            finalizeOnboarding: usersRepo.finalizeOnboarding,
          },
        },
      ],
    }).compile();

    service = module.get(OnboardingService);
    module.get(PromptLoaderService).onModuleInit();
  });

  it('finalizes pending profile when accept is true', async () => {
    const result = await service.finalize('uid-1', { accept: true });

    expect(usersRepo.finalizeOnboarding).toHaveBeenCalledWith('uid-1');
    expect(result).toEqual({ isConfigured: true });
  });

  it('rejects when accept is not true', async () => {
    await expect(service.finalize('uid-1', { accept: false })).rejects.toMatchObject(
      { error: LucyErrorCodes.VALIDATION_ERROR },
    );
    expect(usersRepo.finalizeOnboarding).not.toHaveBeenCalled();
  });

  it('returns 403 when user is already configured', async () => {
    usersRepo.getOnboardingState.mockResolvedValue({
      isConfigured: true,
      onboardingAttempts: {},
    });

    await expect(service.finalize('uid-1', { accept: true })).rejects.toMatchObject(
      { error: LucyErrorCodes.ONBOARDING_ALREADY_COMPLETE },
    );
  });

  it('maps missing pending profile to ONBOARDING_PENDING_PROFILE_MISSING', async () => {
    usersRepo.finalizeOnboarding.mockRejectedValue(
      new Error('ONBOARDING_PENDING_PROFILE_MISSING'),
    );

    await expect(service.finalize('uid-1', { accept: true })).rejects.toMatchObject({
      error: LucyErrorCodes.ONBOARDING_PENDING_PROFILE_MISSING,
    });
  });
});
