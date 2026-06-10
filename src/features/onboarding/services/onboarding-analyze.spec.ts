import { Test } from '@nestjs/testing';

import { LucyErrorCodes } from '../../../core/errors/lucy-error-codes';
import { LLM_PORT } from '../../../core/llm/llm.tokens';
import type { LlmPort } from '../../../core/llm/llm.port';
import { PromptLoaderService } from '../../../core/prompt/prompt-loader.service';
import type { OnboardingTranscriptTurn } from '../domain/onboarding-transcript';
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

describe('OnboardingService.analyze', () => {
  let service: OnboardingService;
  let llmPort: jest.Mocked<LlmPort>;
  let usersRepo: {
    getOnboardingState: jest.Mock;
    getAnalyzeContext: jest.Mock;
    incrementAnalyzeAttempts: jest.Mock;
    saveAnalyzeSuccess: jest.Mock;
  };

  const validProfile = {
    primary_role: 'student',
    main_domains: ['sciences'],
    learning_goal: 'exam',
    self_assessed_level: 'intermediate',
    explanation_style: 'step_by_step',
    feedback_tone: 'encouraging',
    tutoring_language: 'fr',
  };

  beforeEach(async () => {
    llmPort = { generateStructured: jest.fn() };
    usersRepo = {
      getOnboardingState: jest.fn().mockResolvedValue({
        isConfigured: false,
        onboardingAttempts: {},
      }),
      getAnalyzeContext: jest.fn().mockResolvedValue({
        isConfigured: false,
        onboardingAnalyzeAttempts: 0,
        transcript: buildFullTranscript(),
      }),
      incrementAnalyzeAttempts: jest.fn().mockResolvedValue(1),
      saveAnalyzeSuccess: jest.fn().mockResolvedValue(undefined),
    };

    const module = await Test.createTestingModule({
      providers: [
        OnboardingService,
        PromptLoaderService,
        OnboardingQuestionCatalog,
        { provide: LLM_PORT, useValue: llmPort },
        { provide: ONBOARDING_USERS_REPOSITORY, useValue: usersRepo },
      ],
    }).compile();

    service = module.get(OnboardingService);
    module.get(PromptLoaderService).onModuleInit();
  });

  it('returns learnerProfile and summaryForUser when transcript has 7 turns', async () => {
    llmPort.generateStructured.mockResolvedValue({
      rawText: '{}',
      parsedJson: {
        learnerProfile: validProfile,
        summaryForUser: 'Résumé pour toi.',
      },
    });

    const result = await service.analyze('uid-1', { locale: 'fr' });

    expect(result).toEqual({
      learnerProfile: validProfile,
      summaryForUser: 'Résumé pour toi.',
    });
    expect(usersRepo.incrementAnalyzeAttempts).toHaveBeenCalledWith('uid-1');
    expect(usersRepo.saveAnalyzeSuccess).toHaveBeenCalledWith(
      'uid-1',
      validProfile,
      'Résumé pour toi.',
    );
    expect(llmPort.generateStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: expect.stringContaining('learnerProfile'),
        userPrompt: expect.stringContaining('q_role'),
      }),
    );
  });

  it('rejects when transcript is incomplete', async () => {
    usersRepo.getAnalyzeContext.mockResolvedValue({
      isConfigured: false,
      onboardingAnalyzeAttempts: 0,
      transcript: buildFullTranscript().slice(0, 6),
    });

    await expect(service.analyze('uid-1', { locale: 'fr' })).rejects.toMatchObject({
      error: LucyErrorCodes.ONBOARDING_TRANSCRIPT_INCOMPLETE,
      statusCode: 400,
    });
    expect(llmPort.generateStructured).not.toHaveBeenCalled();
  });

  it('rejects when onboarding is already complete', async () => {
    usersRepo.getAnalyzeContext.mockResolvedValue({
      isConfigured: true,
      onboardingAnalyzeAttempts: 0,
      transcript: buildFullTranscript(),
    });

    await expect(service.analyze('uid-1', { locale: 'fr' })).rejects.toMatchObject({
      error: LucyErrorCodes.ONBOARDING_ALREADY_COMPLETE,
      statusCode: 403,
    });
  });
});
