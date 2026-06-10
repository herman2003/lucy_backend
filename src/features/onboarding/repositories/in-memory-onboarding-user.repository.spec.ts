import { InMemoryUsersStore } from '../../../core/persistence/in-memory-users.store';
import { InMemoryOnboardingUsersRepository } from './in-memory-onboarding-user.repository';
import { OnboardingQuestionCatalog } from '../questions/onboarding-question.catalog';

describe('InMemoryOnboardingUsersRepository', () => {
  const store = new InMemoryUsersStore();
  const repo = new InMemoryOnboardingUsersRepository(store);
  const uid = 'dev-user';

  it('confirmTurn accumulates seven unique question ids', async () => {
    for (const questionId of OnboardingQuestionCatalog.orderedQuestionIds) {
      await repo.confirmTurn(uid, {
        locale: 'fr',
        questionId,
        questionText: `Q ${questionId}`,
        answerText: `Answer for ${questionId}`,
      });
    }

    const context = await repo.getAnalyzeContext(uid);
    expect(context.transcript).toHaveLength(7);
    expect(context.isConfigured).toBe(false);
  });

  it('finalize sets isConfigured and learnerProfile', async () => {
    const profile = {
      primary_role: 'student' as const,
      main_domains: ['sciences' as const],
      learning_goal: 'exam' as const,
      self_assessed_level: 'intermediate' as const,
      explanation_style: 'step_by_step' as const,
      feedback_tone: 'encouraging' as const,
      tutoring_language: 'fr' as const,
    };

    await repo.saveAnalyzeSuccess(uid, profile, 'Résumé mock.');
    await repo.finalizeOnboarding(uid);

    const doc = repo.getDocument(uid);
    expect(doc.isConfigured).toBe(true);
    expect(doc.learnerProfile).toEqual(profile);
    expect(doc.pendingLearnerProfile).toBeUndefined();
  });
});
