import { Test } from '@nestjs/testing';

import { LucyErrorCodes } from '../../../core/errors/lucy-error-codes';
import { LucyApiError } from '../../../core/errors/lucy-api.error';
import { MockLlmAdapter } from '../../../core/llm/mock.llm.adapter';
import { LLM_PORT } from '../../../core/llm/llm.tokens';
import { PromptLoaderService } from '../../../core/prompt/prompt-loader.service';
import { MAX_ANALYZE_ATTEMPTS } from '../domain/onboarding-limits';
import type { OnboardingTranscriptTurn } from '../domain/onboarding-transcript';
import {
  createInMemoryOnboardingUsersRepository,
  type InMemoryOnboardingUsersRepository,
} from '../repositories/in-memory-onboarding-user.repository';
import { isAnalyzeFallback } from '../dto/analyze-response.dto';
import { ONBOARDING_USERS_REPOSITORY } from '../repositories/onboarding-users.repository.port';
import { OnboardingQuestionCatalog } from '../questions/onboarding-question.catalog';
import { OnboardingService } from './onboarding.service';

function buildFullTranscript(): OnboardingTranscriptTurn[] {
  return OnboardingQuestionCatalog.orderedQuestionIds.map((questionId, i) => ({
    questionId,
    questionText: `Q${i}`,
    answerText: `A${i}`,
    confirmedAt: '2026-05-25T12:00:00.000Z',
  }));
}

describe('OnboardingService analyze fallback (SPEC §4.6 UX-3)', () => {
  let service: OnboardingService;
  let users: InMemoryOnboardingUsersRepository;
  let llmPort: { generateStructured: jest.Mock };

  const uid = 'uid-analyze-fallback';

  beforeEach(async () => {
    users = createInMemoryOnboardingUsersRepository();
    await users.confirmTurn(uid, {
      locale: 'fr',
      questionId: 'q_role',
      questionText: 'Role?',
      answerText: 'Student',
    });
    for (const questionId of OnboardingQuestionCatalog.orderedQuestionIds.slice(1)) {
      await users.confirmTurn(uid, {
        locale: 'fr',
        questionId,
        questionText: questionId,
        answerText: 'Answer',
      });
    }

    const adapter = new MockLlmAdapter();
    llmPort = {
      generateStructured: jest.fn(async (input) => {
        const schema = input.responseJsonSchema as { required?: string[] };
        if (schema.required?.includes('fallbackProfileSummary')) {
          return adapter.generateStructured(input);
        }
        throw new LucyApiError(
          502,
          LucyErrorCodes.LLM_RESPONSE_INVALID,
          'invalid analyze json',
        );
      }),
    };

    const module = await Test.createTestingModule({
      providers: [
        OnboardingService,
        PromptLoaderService,
        OnboardingQuestionCatalog,
        { provide: LLM_PORT, useValue: llmPort },
        { provide: ONBOARDING_USERS_REPOSITORY, useValue: users },
      ],
    }).compile();

    service = module.get(OnboardingService);
    module.get(PromptLoaderService).onModuleInit();
  });

  it('returns fallbackProfileSummary when analyze attempts reach the limit', async () => {
    for (let i = 0; i < MAX_ANALYZE_ATTEMPTS - 1; i++) {
      await expect(service.analyze(uid, { locale: 'fr' })).rejects.toMatchObject({
        error: LucyErrorCodes.LLM_RESPONSE_INVALID,
      });
    }

    const result = await service.analyze(uid, { locale: 'fr' });

    expect(isAnalyzeFallback(result)).toBe(true);
    if (isAnalyzeFallback(result)) {
      expect(result.fallbackProfileSummary.length).toBeGreaterThan(0);
      expect(result.requiresUserConfirmation).toBe(true);
    }

    const doc = users.getDocument(uid);
    expect(doc.pendingSummaryForUser).toBeTruthy();
    expect(doc.pendingLearnerProfile).toBeTruthy();
  });
});
