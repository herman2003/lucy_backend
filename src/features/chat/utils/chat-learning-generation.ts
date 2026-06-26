import type { LearningSessionType } from '../../learning-sessions/domain/learning-session.types';
import { parseWrittenLearningItemCount } from '../../learning-sessions/utils/learning-item-count-words.util';
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

const REVISION_PLAN_INTENT_PATTERNS = [
  /plan\s+de\s+r[eé]vision/i,
  /plan\s+r[eé]vision/i,
  /r[eé]vision\s+plan/i,
  /\brevision\s+plan\b/i,
  /fais[\s-]?moi un plan (?:de |pour )?r[eé]vis/i,
  /génère(?:r)? (?:un |le )?plan (?:de |pour )?r[eé]vis/i,
  /crée(?:r)? (?:un |le )?plan (?:de |pour )?r[eé]vis/i,
  /organise(?:r)? ma r[eé]vision/i,
  /\blernplan\b/i,
  /erstell(?:e|en)? (?:einen )?lernplan/i,
  /create (?:a )?revision plan/i,
  /generate (?:a )?revision plan/i,
  /calendrier(?:\s+de)?\s+r[eé]vision/i,
  /revision calendar/i,
  /lernkalender/i,
];

const REGENERATION_INTENT_PATTERNS = [
  /refais(?:\s+pareil)?/i,
  /recommence/i,
  /encore(?:\s+une\s+fois)?/i,
  /regénère(?:\s+pareil)?/i,
  /regenere(?:\s+pareil)?/i,
  /same again/i,
  /do it again/i,
  /\bredo\b/i,
  /nochmal/i,
  /noch\s+einmal/i,
  /erneut/i,
];

export function detectLearningRegenerationIntent(message: string): boolean {
  const normalized = message.trim();
  if (!normalized) {
    return false;
  }
  return REGENERATION_INTENT_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function detectRevisionPlanIntent(message: string): boolean {
  const normalized = message.trim();
  if (!normalized) {
    return false;
  }
  return REVISION_PLAN_INTENT_PATTERNS.some((pattern) => pattern.test(normalized));
}

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
  return parseWrittenLearningItemCount(message);
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
