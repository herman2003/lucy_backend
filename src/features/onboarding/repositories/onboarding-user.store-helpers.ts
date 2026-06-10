import { OnboardingQuestionCatalog } from '../questions/onboarding-question.catalog';
import type {
  ConfirmTurnParams,
  ConfirmTurnResult,
  OnboardingUserDocument,
} from './onboarding-user.types';
import type { OnboardingTranscriptTurn } from '../domain/onboarding-transcript';

export function readAnalyzeAttempts(data: OnboardingUserDocument): number {
  const value = data.onboardingAnalyzeAttempts;
  return typeof value === 'number' && value >= 0 ? value : 0;
}

export function parseTranscript(raw: unknown): OnboardingTranscriptTurn[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const turns: OnboardingTranscriptTurn[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const record = item as Record<string, unknown>;
    const questionId = record.questionId;
    const questionText = record.questionText;
    const answerText = record.answerText;
    const confirmedAt = record.confirmedAt;
    if (
      typeof questionId === 'string' &&
      typeof questionText === 'string' &&
      typeof answerText === 'string' &&
      typeof confirmedAt === 'string'
    ) {
      turns.push({ questionId, questionText, answerText, confirmedAt });
    }
  }
  return turns;
}

export function countUniqueQuestionIds(
  transcript: OnboardingTranscriptTurn[],
): number {
  return new Set(transcript.map((t) => t.questionId)).size;
}

export function applyConfirmTurn(
  data: OnboardingUserDocument,
  params: ConfirmTurnParams,
): ConfirmTurnResult {
  const confirmedAt = new Date().toISOString();
  const transcript = parseTranscript(data.onboardingTranscript);
  const withoutCurrent = transcript.filter(
    (t) => t.questionId !== params.questionId,
  );
  const updated: OnboardingTranscriptTurn[] = [
    ...withoutCurrent,
    {
      questionId: params.questionId,
      questionText: params.questionText,
      answerText: params.answerText,
      confirmedAt,
    },
  ];

  const completedTurns = countUniqueQuestionIds(updated);
  const onboardingStatus =
    completedTurns >= OnboardingQuestionCatalog.orderedQuestionIds.length
      ? 'awaiting_analyze'
      : 'in_progress';

  data.onboardingTranscript = updated;
  data.onboardingStatus = onboardingStatus;

  if (params.questionId === 'q_language') {
    data.tutoringLanguage = params.locale;
  }

  return { onboardingStatus, completedTurns };
}
