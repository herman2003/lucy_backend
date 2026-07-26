import {
  buildLearningSessionCreatedReply,
  detectLearningGenerationIntent,
  detectLearningRegenerationIntent,
  detectRevisionPlanIntent,
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

  it('detects revision plan intent without triggering quiz (LEARN-10c)', () => {
    expect(detectRevisionPlanIntent('fais-moi un plan de révision')).toBe(true);
    expect(detectRevisionPlanIntent('revision plan for my exam')).toBe(true);
    expect(detectRevisionPlanIntent('erstell einen Lernplan')).toBe(true);
    expect(detectRevisionPlanIntent('fais-moi un quiz')).toBe(false);
    expect(detectRevisionPlanIntent("Qu'est-ce que l'entropie ?")).toBe(false);
  });

  it('detects regeneration intent from common phrases (LEARN-09c)', () => {
    expect(detectLearningRegenerationIntent('refais pareil')).toBe(true);
    expect(detectLearningRegenerationIntent('same again please')).toBe(true);
    expect(detectLearningRegenerationIntent('nochmal')).toBe(true);
    expect(detectLearningGenerationIntent('refais pareil')).toBeNull();
  });

  it('parses optional item count from the message', () => {
    expect(parseLearningItemCount('fais-moi un quiz de 8 questions')).toBe(8);
    expect(parseLearningItemCount('fais-moi un quiz')).toBeUndefined();
  });

  it('parses written item counts in letters (LEARN-11b)', () => {
    expect(parseLearningItemCount('quinze')).toBe(15);
    expect(parseLearningItemCount('fifteen')).toBe(15);
    expect(parseLearningItemCount('fais-moi un quiz de quinze questions')).toBe(15);
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
