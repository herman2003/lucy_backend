import { Test } from '@nestjs/testing';

import { MockLlmAdapter } from '../../../core/llm/mock.llm.adapter';
import { LLM_PORT } from '../../../core/llm/llm.tokens';
import { PromptLoaderService } from '../../../core/prompt/prompt-loader.service';
import { MAX_VALIDATE_ATTEMPTS_PER_QUESTION } from '../domain/onboarding-limits';
import {
  createInMemoryOnboardingUsersRepository,
  type InMemoryOnboardingUsersRepository,
} from '../repositories/in-memory-onboarding-user.repository';
import { ONBOARDING_USERS_REPOSITORY } from '../repositories/onboarding-users.repository.port';
import { OnboardingQuestionCatalog } from '../questions/onboarding-question.catalog';
import { isValidateAnswerFallback } from '../dto/validate-answer.dto';
import { OnboardingService } from './onboarding.service';

describe('OnboardingService validate attempts (SPEC §4.6)', () => {
  let service: OnboardingService;
  let users: InMemoryOnboardingUsersRepository;

  const validateBody = {
    locale: 'fr' as const,
    turn: { questionId: 'q_role', answerText: 'euh' },
  };

  beforeEach(async () => {
    users = createInMemoryOnboardingUsersRepository();

    const module = await Test.createTestingModule({
      providers: [
        OnboardingService,
        PromptLoaderService,
        OnboardingQuestionCatalog,
        { provide: LLM_PORT, useClass: MockLlmAdapter },
        { provide: ONBOARDING_USERS_REPOSITORY, useValue: users },
      ],
    }).compile();

    service = module.get(OnboardingService);
    module.get(PromptLoaderService).onModuleInit();
  });

  it('increments onboardingAttempts on valid false', async () => {
    const uid = 'uid-attempts';
    await service.validateAnswer(uid, validateBody);

    const doc = users.getDocument(uid);
    expect(doc.onboardingAttempts?.q_role).toBe(1);
  });

  it('returns fallbackSummary when attempts reach the limit', async () => {
    const uid = 'uid-fallback';
    for (let i = 0; i < MAX_VALIDATE_ATTEMPTS_PER_QUESTION; i++) {
      await service.validateAnswer(uid, validateBody);
    }

    const result = await service.validateAnswer(uid, validateBody);

    expect(isValidateAnswerFallback(result)).toBe(true);
    if (isValidateAnswerFallback(result)) {
      expect(result.fallbackSummary.length).toBeGreaterThan(0);
      expect(result.reason).toBe('max_attempts');
    }
  });

  it('returns shorter fallbackSummary when fallbackReduced is true', async () => {
    const uid = 'uid-reduced';
    for (let i = 0; i < MAX_VALIDATE_ATTEMPTS_PER_QUESTION; i++) {
      await service.validateAnswer(uid, validateBody);
    }

    const full = await service.validateAnswer(uid, validateBody);
    const reduced = await service.validateAnswer(uid, {
      ...validateBody,
      fallbackReduced: true,
    });

    expect(isValidateAnswerFallback(full)).toBe(true);
    expect(isValidateAnswerFallback(reduced)).toBe(true);
    if (isValidateAnswerFallback(full) && isValidateAnswerFallback(reduced)) {
      expect(reduced.fallbackSummary.length).toBeLessThan(
        full.fallbackSummary.length,
      );
    }
  });
});
