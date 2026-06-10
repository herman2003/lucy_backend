import type { LearningSessionType } from '../../learning-sessions/domain/learning-session.types';
import type { TutoringLanguage } from '../../onboarding/domain/learner-profile.enums';

const QUIZ_INTENT_PATTERNS = [
  /\bquiz\b/i,
  /\bqcm\b/i,
  /fais[\s-]?moi un quiz/i,
  /génère(?:r)? (?:un |le )?quiz/i,
  /crée(?:r)? (?:un |le )?quiz/i,
  /create (?:a )?quiz/i,
  /generate (?:a )?quiz/i,
];

const FLASHCARDS_INTENT_PATTERNS = [
  /\bflashcards?\b/i,
  /\bcartes?(?:\s+m[ée]moire)?\b/i,
  /fais[\s-]?moi (?:des |les )?cartes/i,
  /génère(?:r)? (?:des |les )?cartes/i,
  /crée(?:r)? (?:des |les )?cartes/i,
  /create (?:some )?flashcards/i,
  /generate flashcards/i,
];

export function detectLearningGenerationIntent(
  message: string,
): LearningSessionType | null {
  const normalized = message.trim();
  if (!normalized) {
    return null;
  }
  if (QUIZ_INTENT_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return 'quiz';
  }
  if (FLASHCARDS_INTENT_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return 'flashcards';
  }
  return null;
}

export function parseLearningItemCount(message: string): number | undefined {
  const match = message.match(/\b(\d{1,2})\b/);
  if (!match) {
    return undefined;
  }
  return Number.parseInt(match[1]!, 10);
}

export function buildLearningSessionCreatedReply(
  tutoringLanguage: TutoringLanguage,
  type: LearningSessionType,
  title: string,
): string {
  switch (tutoringLanguage) {
    case 'en':
      return type === 'quiz'
        ? `Your quiz is ready: **${title}**. Open it to start practicing.`
        : `Your flashcards are ready: **${title}**. Open them to start reviewing.`;
    case 'de':
      return type === 'quiz'
        ? `Dein Quiz ist bereit: **${title}**. Öffne es, um zu üben.`
        : `Deine Karteikarten sind bereit: **${title}**. Öffne sie zum Lernen.`;
    case 'fr':
    default:
      return type === 'quiz'
        ? `Ton quiz est prêt : **${title}**. Ouvre-le pour t'entraîner.`
        : `Tes cartes sont prêtes : **${title}**. Ouvre-les pour réviser.`;
  }
}
