import { LucyErrorCodes } from '../../../core/errors/lucy-error-codes';
import { LucyApiError } from '../../../core/errors/lucy-api.error';
import { OnboardingQuestionCatalog } from '../questions/onboarding-question.catalog';

export type OnboardingTranscriptTurn = {
  questionId: string;
  questionText: string;
  answerText: string;
  confirmedAt: string;
};

export function assertTranscriptComplete(
  transcript: OnboardingTranscriptTurn[],
): void {
  const requiredIds = OnboardingQuestionCatalog.orderedQuestionIds;

  if (transcript.length !== requiredIds.length) {
    throw transcriptIncomplete('Transcript must contain exactly 7 confirmed turns');
  }

  const seen = new Set<string>();
  for (const turn of transcript) {
    if (!(requiredIds as readonly string[]).includes(turn.questionId)) {
      throw transcriptIncomplete(`Invalid questionId: ${turn.questionId}`);
    }
    if (seen.has(turn.questionId)) {
      throw transcriptIncomplete(`Duplicate questionId: ${turn.questionId}`);
    }
    seen.add(turn.questionId);
  }

  for (const questionId of requiredIds) {
    if (!seen.has(questionId)) {
      throw transcriptIncomplete(`Missing questionId: ${questionId}`);
    }
  }
}

function transcriptIncomplete(message: string): LucyApiError {
  return new LucyApiError(
    400,
    LucyErrorCodes.ONBOARDING_TRANSCRIPT_INCOMPLETE,
    message,
  );
}
