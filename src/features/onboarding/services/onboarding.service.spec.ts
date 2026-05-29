import { Test } from '@nestjs/testing';

import { LucyErrorCodes } from '../../../core/errors/lucy-error-codes';
import { LLM_PORT } from '../../../core/llm/llm.tokens';
import type { LlmPort } from '../../../core/llm/llm.port';
import { PromptLoaderService } from '../../../core/prompt/prompt-loader.service';
import { ONBOARDING_USERS_REPOSITORY } from '../repositories/onboarding-users.repository.port';
import { OnboardingQuestionCatalog } from '../questions/onboarding-question.catalog';
import { OnboardingService } from './onboarding.service';

describe('OnboardingService', () => {
  let service: OnboardingService;
  let llmPort: jest.Mocked<LlmPort>;

  beforeEach(async () => {
    llmPort = {
      generateStructured: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        OnboardingService,
        PromptLoaderService,
        OnboardingQuestionCatalog,
        {
          provide: LLM_PORT,
          useValue: llmPort,
        },
        {
          provide: ONBOARDING_USERS_REPOSITORY,
          useValue: {
            getOnboardingState: jest.fn().mockResolvedValue({
              isConfigured: false,
              onboardingAttempts: {},
            }),
            incrementValidateAttempt: jest.fn().mockResolvedValue(1),
          },
        },
      ],
    }).compile();

    service = module.get(OnboardingService);
    module.get(PromptLoaderService).onModuleInit();
  });

  const validBody = {
    locale: 'fr',
    turn: {
      questionId: 'q_role',
      answerText: 'Je suis étudiant en L2 biologie à Paris.',
    },
  };

  it('returns valid true with turnSummary when LLM accepts the answer', async () => {
    llmPort.generateStructured.mockResolvedValue({
      rawText: '{}',
      parsedJson: {
        valid: true,
        turnSummary: 'Tu es étudiant en biologie en L2.',
      },
    });

    const result = await service.validateAnswer('uid-1', validBody);

    expect(result).toEqual({
      valid: true,
      turnSummary: 'Tu es étudiant en biologie en L2.',
    });
    expect(llmPort.generateStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: expect.stringContaining('rephrasedQuestion'),
        userPrompt: expect.stringContaining('Je suis étudiant'),
      }),
    );
  });

  it('returns valid false with rephrasedQuestion when LLM rejects vague answer', async () => {
    llmPort.generateStructured.mockResolvedValue({
      rawText: '{}',
      parsedJson: {
        valid: false,
        rephrasedQuestion:
          'Tu es plutôt étudiant, en reconversion, ou tu apprends seul ?',
        reason: 'too_vague',
      },
    });

    const result = await service.validateAnswer('uid-1', {
      ...validBody,
      turn: { ...validBody.turn, answerText: 'euh' },
    });

    expect(result).toEqual({
      valid: false,
      rephrasedQuestion:
        'Tu es plutôt étudiant, en reconversion, ou tu apprends seul ?',
      reason: 'too_vague',
    });
  });

  it('rejects when onboarding is already complete', async () => {
    const repo = {
      getOnboardingState: jest.fn().mockResolvedValue({
        isConfigured: true,
        onboardingAttempts: {},
      }),
    };

    const module = await Test.createTestingModule({
      providers: [
        OnboardingService,
        PromptLoaderService,
        OnboardingQuestionCatalog,
        { provide: LLM_PORT, useValue: llmPort },
        { provide: ONBOARDING_USERS_REPOSITORY, useValue: repo },
      ],
    }).compile();
    module.get(PromptLoaderService).onModuleInit();

    await expect(
      module.get(OnboardingService).validateAnswer('uid-1', validBody),
    ).rejects.toMatchObject({
      error: LucyErrorCodes.ONBOARDING_ALREADY_COMPLETE,
      statusCode: 403,
    });
  });

  it('rejects answers longer than 2000 characters', async () => {
    await expect(
      service.validateAnswer('uid-1', {
        ...validBody,
        turn: { ...validBody.turn, answerText: 'x'.repeat(2001) },
      }),
    ).rejects.toMatchObject({
      error: LucyErrorCodes.ANSWER_TOO_LONG,
      statusCode: 400,
    });
  });
});
