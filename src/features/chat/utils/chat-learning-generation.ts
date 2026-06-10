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
  title: string,
): string {
  switch (tutoringLanguage) {
    case 'en':
      return `Your quiz is ready: **${title}**. Open it to start practicing.`;
    case 'de':
      return `Dein Quiz ist bereit: **${title}**. Öffne es, um zu üben.`;
    case 'fr':
    default:
      return `Ton quiz est prêt : **${title}**. Ouvre-le pour t'entraîner.`;
  }
}
