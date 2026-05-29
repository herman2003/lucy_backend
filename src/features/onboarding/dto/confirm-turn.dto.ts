import { LucyErrorCodes } from '../../../core/errors/lucy-error-codes';
import { LucyApiError } from '../../../core/errors/lucy-api.error';
import { OnboardingQuestionCatalog } from '../questions/onboarding-question.catalog';

export type ConfirmTurnRequestDto = {
  locale: string;
  confirmationType: 'normal' | 'fallback';
  turn: {
    questionId: string;
    answerText: string;
  };
  fallbackReduced?: boolean;
};

export type ConfirmTurnResponseDto = {
  onboardingStatus: string;
  completedTurns: number;
};

export function parseConfirmTurnRequest(body: unknown): ConfirmTurnRequestDto {
  if (!body || typeof body !== 'object') {
    throw validationError('Request body must be an object');
  }

  const record = body as Record<string, unknown>;
  const locale = record.locale;
  if (typeof locale !== 'string' || !['fr', 'en', 'de'].includes(locale)) {
    throw validationError('locale must be fr, en, or de');
  }

  const confirmationType = record.confirmationType;
  if (confirmationType !== 'normal' && confirmationType !== 'fallback') {
    throw validationError('confirmationType must be normal or fallback');
  }

  const turnRaw = record.turn;
  if (!turnRaw || typeof turnRaw !== 'object') {
    throw validationError('turn is required');
  }

  const turn = turnRaw as Record<string, unknown>;
  const questionId = turn.questionId;
  const answerText = turn.answerText;

  if (typeof questionId !== 'string') {
    throw validationError('turn.questionId is required');
  }
  if (
    !(OnboardingQuestionCatalog.orderedQuestionIds as readonly string[]).includes(
      questionId,
    )
  ) {
    throw validationError(`Invalid turn.questionId: ${questionId}`);
  }

  if (typeof answerText !== 'string' || !answerText.trim()) {
    throw validationError('turn.answerText must be a non-empty string');
  }

  const dto: ConfirmTurnRequestDto = {
    locale,
    confirmationType,
    turn: { questionId, answerText: answerText.trim() },
  };

  if (record.fallbackReduced === true) {
    dto.fallbackReduced = true;
  }

  return dto;
}

function validationError(message: string): LucyApiError {
  return new LucyApiError(400, LucyErrorCodes.VALIDATION_ERROR, message);
}
