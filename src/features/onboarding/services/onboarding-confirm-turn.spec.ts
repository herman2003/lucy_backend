import { Test } from '@nestjs/testing';

import { LucyErrorCodes } from '../../../core/errors/lucy-error-codes';
import { LLM_PORT } from '../../../core/llm/llm.tokens';
import type { LlmPort } from '../../../core/llm/llm.port';
import { PromptLoaderService } from '../../../core/prompt/prompt-loader.service';
import type { OnboardingTranscriptTurn } from '../domain/onboarding-transcript';
import { ONBOARDING_USERS_REPOSITORY } from '../repositories/onboarding-users.repository.port';
import { OnboardingQuestionCatalog } from '../questions/onboarding-question.catalog';
import { OnboardingService } from './onboarding.service';

describe('OnboardingService.confirmTurn', () => {
  let service: OnboardingService;
  let usersRepo: {
    getOnboardingState: jest.Mock;
    getAnalyzeContext: jest.Mock;
    confirmTurn: jest.Mock;
    incrementAnalyzeAttempts: jest.Mock;
    saveAnalyzeSuccess: jest.Mock;
  };

  const body = {
    locale: 'fr',
    confirmationType: 'normal',
    turn: {
      questionId: 'q_role',
      answerText: 'Je suis étudiant en L2 biologie.',
    },
  };

  beforeEach(async () => {
    usersRepo = {
      getOnboardingState: jest.fn().mockResolvedValue({
        isConfigured: false,
        onboardingAttempts: {},
      }),
      getAnalyzeContext: jest.fn(),
      confirmTurn: jest.fn().mockResolvedValue({
        onboardingStatus: 'in_progress',
        completedTurns: 1,
      }),
      incrementAnalyzeAttempts: jest.fn(),
      saveAnalyzeSuccess: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        OnboardingService,
        PromptLoaderService,
        OnboardingQuestionCatalog,
        { provide: LLM_PORT, useValue: { generateStructured: jest.fn() } },
        { provide: ONBOARDING_USERS_REPOSITORY, useValue: usersRepo },
      ],
    }).compile();

    service = module.get(OnboardingService);
    module.get(PromptLoaderService).onModuleInit();
  });

  it('persists turn via repository and returns status', async () => {
    const result = await service.confirmTurn('uid-1', body);

    expect(result).toEqual({
      onboardingStatus: 'in_progress',
      completedTurns: 1,
    });
    expect(usersRepo.confirmTurn).toHaveBeenCalledWith(
      'uid-1',
      expect.objectContaining({
        locale: 'fr',
        questionId: 'q_role',
        answerText: body.turn.answerText,
      }),
    );
  });

  it('returns awaiting_analyze when seventh turn is confirmed', async () => {
    usersRepo.confirmTurn.mockResolvedValue({
      onboardingStatus: 'awaiting_analyze',
      completedTurns: 7,
    });

    const result = await service.confirmTurn('uid-1', {
      ...body,
      turn: { questionId: 'q_language', answerText: 'Français' },
    });

    expect(result.onboardingStatus).toBe('awaiting_analyze');
    expect(result.completedTurns).toBe(7);
  });

  it('rejects when onboarding is already complete', async () => {
    usersRepo.getOnboardingState.mockResolvedValue({
      isConfigured: true,
      onboardingAttempts: {},
    });

    await expect(service.confirmTurn('uid-1', body)).rejects.toMatchObject({
      error: LucyErrorCodes.ONBOARDING_ALREADY_COMPLETE,
      statusCode: 403,
    });
  });
});
