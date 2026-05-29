import { LucyErrorCodes } from '../../../core/errors/lucy-error-codes';
import { LucyApiError } from '../../../core/errors/lucy-api.error';
import type {
  ValidateAnswerFallbackDto,
  ValidateAnswerResponseDto,
  ValidateAnswerRetryDto,
  ValidateAnswerSuccessDto,
} from '../dto/validate-answer.dto';

const VALID_REASONS = new Set([
  'too_vague',
  'off_topic',
  'too_short',
  'unintelligible',
  'too_long',
  'wrong_language',
]);

const FORBIDDEN_REPHRASE_PATTERNS = [
  /peux-tu préciser/i,
  /peux-tu en dire plus/i,
  /\bclarifie\b/i,
  /can you clarify/i,
  /can you be more specific/i,
  /tell me more/i,
];

export function parseValidateAnswerLlmResponse(
  parsed: unknown,
): ValidateAnswerResponseDto {
  if (!parsed || typeof parsed !== 'object') {
    throw llmInvalid('LLM response is not an object');
  }

  const record = parsed as Record<string, unknown>;
  if (typeof record.valid !== 'boolean') {
    throw llmInvalid('valid must be a boolean');
  }

  if (record.valid === true) {
    return parseValidTrue(record);
  }

  return parseValidFalse(record);
}

function parseValidTrue(record: Record<string, unknown>): ValidateAnswerSuccessDto {
  const turnSummary = record.turnSummary;
  if (typeof turnSummary !== 'string' || !turnSummary.trim()) {
    throw llmInvalid('turnSummary is required when valid is true');
  }
  return { valid: true, turnSummary: turnSummary.trim() };
}

function parseValidFalse(
  record: Record<string, unknown>,
): ValidateAnswerRetryDto | ValidateAnswerFallbackDto {
  const fallbackSummary = record.fallbackSummary;
  if (typeof fallbackSummary === 'string' && fallbackSummary.trim()) {
    return {
      valid: false,
      fallbackSummary: fallbackSummary.trim(),
      reason: 'max_attempts',
    };
  }

  const rephrasedQuestion = record.rephrasedQuestion;
  if (typeof rephrasedQuestion !== 'string' || !rephrasedQuestion.trim()) {
    throw llmInvalid('rephrasedQuestion is required when valid is false');
  }

  const trimmed = rephrasedQuestion.trim();
  for (const pattern of FORBIDDEN_REPHRASE_PATTERNS) {
    if (pattern.test(trimmed)) {
      throw llmInvalid(
        'rephrasedQuestion must not be a meta-request (e.g. "Peux-tu préciser")',
      );
    }
  }

  const reason = record.reason;
  if (typeof reason !== 'string' || !VALID_REASONS.has(reason)) {
    throw llmInvalid('reason must be a supported validation reason');
  }

  return { valid: false, rephrasedQuestion: trimmed, reason };
}

function llmInvalid(message: string): LucyApiError {
  return new LucyApiError(502, LucyErrorCodes.LLM_RESPONSE_INVALID, message);
}
