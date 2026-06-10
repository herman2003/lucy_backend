import { Test } from '@nestjs/testing';

import { MockLlmAdapter } from '../../../core/llm/mock.llm.adapter';
import { LLM_PORT } from '../../../core/llm/llm.tokens';
import { LucyErrorCodes } from '../../../core/errors/lucy-error-codes';
import { PromptLoaderService } from '../../../core/prompt/prompt-loader.service';
import {
  createInMemoryOnboardingUsersRepository,
  type InMemoryOnboardingUsersRepository,
} from '../repositories/in-memory-onboarding-user.repository';
import { ONBOARDING_USERS_REPOSITORY } from '../repositories/onboarding-users.repository.port';
import { OnboardingQuestionCatalog } from '../questions/onboarding-question.catalog';
import { isAnalyzeFallback } from '../dto/analyze-response.dto';
import { OnboardingService } from './onboarding.service';

/** CP-3 / CP-4 dev path: mock LLM + in-memory Firestore (no service account). */
describe('OnboardingService full flow (memory + mock LLM)', () => {
  let service: OnboardingService;
  let users: InMemoryOnboardingUsersRepository;

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

  it('analyze returns learnerProfile after seven confirm-turn writes', async () => {
    const uid = 'flow-user';

    for (const questionId of OnboardingQuestionCatalog.orderedQuestionIds) {
      await service.confirmTurn(uid, {
        locale: 'fr',
        confirmationType: 'normal',
        turn: {
          questionId,
          answerText: `Réponse détaillée pour ${questionId} avec assez de contenu.`,
        },
      });
    }

    const analyze = await service.analyze(uid, { locale: 'fr' });

    expect(isAnalyzeFallback(analyze)).toBe(false);
    if (!isAnalyzeFallback(analyze)) {
      expect(analyze.learnerProfile.primary_role).toBe('student');
      expect(analyze.summaryForUser).toBeTruthy();
    }

    const doc = users.getDocument(uid);
    expect(doc.onboardingTranscript).toHaveLength(7);
    expect(doc.pendingLearnerProfile).toBeDefined();
  });

  it('analyze rejects incomplete transcript', async () => {
    await service.confirmTurn('uid-partial', {
      locale: 'fr',
      confirmationType: 'normal',
      turn: {
        questionId: 'q_role',
        answerText: 'Réponse suffisamment longue pour le mock.',
      },
    });

    await expect(service.analyze('uid-partial', { locale: 'fr' })).rejects.toMatchObject({
      error: LucyErrorCodes.ONBOARDING_TRANSCRIPT_INCOMPLETE,
      statusCode: 400,
    });
  });

  it('finalize sets isConfigured after analyze', async () => {
    const uid = 'finalize-user';

    for (const questionId of OnboardingQuestionCatalog.orderedQuestionIds) {
      await service.confirmTurn(uid, {
        locale: 'fr',
        confirmationType: 'normal',
        turn: {
          questionId,
          answerText: `Réponse détaillée pour ${questionId}.`,
        },
      });
    }

    await service.analyze(uid, { locale: 'fr' });
    const result = await service.finalize(uid, { accept: true });

    expect(result).toEqual({ isConfigured: true });
    expect(users.getDocument(uid).isConfigured).toBe(true);
    expect(users.getDocument(uid).learnerProfile).toBeDefined();
  });
});
