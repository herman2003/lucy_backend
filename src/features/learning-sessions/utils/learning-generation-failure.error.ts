import { LucyErrorCodes } from '../../../core/errors/lucy-error-codes';
import { LucyApiError } from '../../../core/errors/lucy-api.error';
import type { LearningGenerationAdviceKey } from '../domain/learning-generation-failure.types';

export function learningGenerationFailed(
  adviceKey: LearningGenerationAdviceKey,
  message: string,
): LucyApiError {
  return new LucyApiError(
    502,
    LucyErrorCodes.LEARNING_GENERATION_FAILED,
    message,
    { adviceKey },
  );
}

export function readLearningGenerationAdviceKey(
  error: unknown,
): LearningGenerationAdviceKey {
  if (!(error instanceof LucyApiError)) {
    return 'unknown';
  }

  const adviceKey = error.details?.adviceKey;
  if (
    adviceKey === 'no_retrieval_hits' ||
    adviceKey === 'invalid_llm_output' ||
    adviceKey === 'unknown'
  ) {
    return adviceKey;
  }

  return 'unknown';
}
