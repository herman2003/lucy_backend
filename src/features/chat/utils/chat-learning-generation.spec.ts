import {
  buildLearningSessionCreatedReply,
  detectLearningGenerationIntent,
  parseLearningItemCount,
} from './chat-learning-generation';

describe('chat-learning-generation (LEARN-01d)', () => {
  it('detects quiz intent from common French phrases', () => {
    expect(detectLearningGenerationIntent('fais-moi un quiz')).toBe('quiz');
    expect(detectLearningGenerationIntent('Génère un quiz QCM')).toBe('quiz');
  });

  it('detects flashcards intent from common French phrases', () => {
    expect(detectLearningGenerationIntent('fais-moi des cartes mémoire')).toBe(
      'flashcards',
    );
    expect(detectLearningGenerationIntent('Génère des flashcards')).toBe(
      'flashcards',
    );
  });

  it('returns null for normal tutoring questions', () => {
    expect(detectLearningGenerationIntent("Qu'est-ce que l'entropie ?")).toBeNull();
  });

  it('parses optional item count from the message', () => {
    expect(parseLearningItemCount('fais-moi un quiz de 8 questions')).toBe(8);
    expect(parseLearningItemCount('fais-moi un quiz')).toBeUndefined();
  });

  it('builds a short assistant reply in tutoring language', () => {
    expect(
      buildLearningSessionCreatedReply('fr', 'quiz', 'Quiz · 2026-05-29'),
    ).toContain('Ton quiz est prêt');
    expect(
      buildLearningSessionCreatedReply('fr', 'flashcards', 'Cartes · 2026-05-29'),
    ).toContain('Tes cartes sont prêtes');
  });
});
