import { Test } from '@nestjs/testing';

import { MockLlmAdapter } from '../../../core/llm/mock.llm.adapter';
import { LLM_PORT } from '../../../core/llm/llm.tokens';
import { PromptLoaderService } from '../../../core/prompt/prompt-loader.service';
import { ONBOARDING_USERS_REPOSITORY } from '../repositories/onboarding-users.repository.port';
import { OnboardingQuestionCatalog } from '../questions/onboarding-question.catalog';
import { OnboardingService } from './onboarding.service';

describe('OnboardingService with MockLlmAdapter (CP-1 dev)', () => {
  let service: OnboardingService;

  beforeEach(async () => {
    const usersRepo = {
      getOnboardingState: jest.fn().mockResolvedValue({
        isConfigured: false,
        onboardingAttempts: {},
      }),
      incrementValidateAttempt: jest.fn().mockResolvedValue(1),
    };

    const module = await Test.createTestingModule({
      providers: [
        OnboardingService,
        PromptLoaderService,
        OnboardingQuestionCatalog,
        { provide: LLM_PORT, useClass: MockLlmAdapter },
        { provide: ONBOARDING_USERS_REPOSITORY, useValue: usersRepo },
      ],
    }).compile();

    service = module.get(OnboardingService);
    module.get(PromptLoaderService).onModuleInit();
  });

  it('validate-answer returns valid true for a clear answer', async () => {
    const result = await service.validateAnswer('uid-1', {
      locale: 'fr',
      turn: {
        questionId: 'q_role',
        answerText: 'Je suis étudiant en L2 biologie.',
      },
    });

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.turnSummary.length).toBeGreaterThan(0);
    }
  });

  it('validate-answer returns valid false with rephrasedQuestion for vague answer', async () => {
    const result = await service.validateAnswer('uid-1', {
      locale: 'fr',
      turn: { questionId: 'q_role', answerText: 'euh' },
    });

    expect(result).toMatchObject({
      valid: false,
      reason: 'too_vague',
    });
    if (!result.valid && 'rephrasedQuestion' in result) {
      expect(result.rephrasedQuestion).not.toMatch(/préciser/i);
    }
  });
});
