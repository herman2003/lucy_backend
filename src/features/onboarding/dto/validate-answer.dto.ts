import { LucyErrorCodes } from '../../../core/errors/lucy-error-codes';
import { LucyApiError } from '../../../core/errors/lucy-api.error';
import { OnboardingQuestionCatalog } from '../questions/onboarding-question.catalog';

export const MAX_ONBOARDING_ANSWER_LENGTH = 2000;

export type ValidateAnswerTurnDto = {
  questionId: string;
  answerText: string;
};

export type ValidateAnswerRequestDto = {
  locale: string;
  turn: ValidateAnswerTurnDto;
  fallbackReduced?: boolean;
};

export type ValidateAnswerSuccessDto = {
  valid: true;
  turnSummary: string;
};

export type ValidateAnswerRetryDto = {
  valid: false;
  rephrasedQuestion: string;
  reason: string;
};

export type ValidateAnswerFallbackDto = {
  valid: false;
  fallbackSummary: string;
  reason: 'max_attempts';
};

export type ValidateAnswerResponseDto =
  | ValidateAnswerSuccessDto
  | ValidateAnswerRetryDto
  | ValidateAnswerFallbackDto;

export function isValidateAnswerFallback(
  response: ValidateAnswerResponseDto,
): response is ValidateAnswerFallbackDto {
  return (
    response.valid === false &&
    'fallbackSummary' in response &&
    typeof response.fallbackSummary === 'string'
  );
}

export function parseValidateAnswerRequest(body: unknown): ValidateAnswerRequestDto {
  if (!body || typeof body !== 'object') {
    throw validationError('Request body must be an object');
  }

  const record = body as Record<string, unknown>;
  const locale = record.locale;
  if (typeof locale !== 'string' || !['fr', 'en', 'de'].includes(locale)) {
    throw validationError('locale must be fr, en, or de');
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

  const trimmedAnswer = answerText.trim();
  if (trimmedAnswer.length > MAX_ONBOARDING_ANSWER_LENGTH) {
    throw new LucyApiError(
      400,
      LucyErrorCodes.ANSWER_TOO_LONG,
      `Answer must be at most ${MAX_ONBOARDING_ANSWER_LENGTH} characters`,
    );
  }

  const dto: ValidateAnswerRequestDto = {
    locale,
    turn: { questionId, answerText: trimmedAnswer },
  };

  if (record.fallbackReduced === true) {
    dto.fallbackReduced = true;
  }

  return dto;
}

function validationError(message: string): LucyApiError {
  return new LucyApiError(400, LucyErrorCodes.VALIDATION_ERROR, message);
}
