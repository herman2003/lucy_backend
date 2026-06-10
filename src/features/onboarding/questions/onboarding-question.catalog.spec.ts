import { OnboardingQuestionCatalog } from './onboarding-question.catalog';

describe('OnboardingQuestionCatalog', () => {
  const catalog = new OnboardingQuestionCatalog();

  it('resolves all seven question ids for fr, en, and de', () => {
    for (const locale of ['fr', 'en', 'de'] as const) {
      for (const questionId of OnboardingQuestionCatalog.orderedQuestionIds) {
        const text = catalog.getQuestionText(locale, questionId);
        expect(text.trim().length).toBeGreaterThan(10);
      }
    }
  });

  it('throws for unknown questionId', () => {
    expect(() => catalog.getQuestionText('fr', 'unknown')).toThrow();
  });

  it('throws for unsupported locale', () => {
    expect(() => catalog.getQuestionText('es', 'q_role')).toThrow();
  });
});
