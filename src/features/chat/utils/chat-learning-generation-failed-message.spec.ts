import { buildLearningGenerationFailedMessage } from './chat-learning-dialogue-messages';

describe('buildLearningGenerationFailedMessage (LEARN-09b)', () => {
  it('returns actionable guidance when no retrieval hits are available', () => {
    expect(
      buildLearningGenerationFailedMessage('fr', 'quiz', 'no_retrieval_hits'),
    ).toContain('pas trouvé assez de contenu');
    expect(
      buildLearningGenerationFailedMessage('en', 'flashcards', 'no_retrieval_hits'),
    ).toContain('enough content');
  });

  it('returns retry guidance when LLM output is invalid', () => {
    expect(
      buildLearningGenerationFailedMessage('fr', 'quiz', 'invalid_llm_output'),
    ).toContain('Réessaie');
    expect(
      buildLearningGenerationFailedMessage('de', 'flashcards', 'invalid_llm_output'),
    ).toContain('Versuche');
  });

  it('returns a generic restart message for unknown failures', () => {
    expect(
      buildLearningGenerationFailedMessage('fr', 'quiz', 'unknown'),
    ).toContain('Réessaie depuis le chat');
  });
});
