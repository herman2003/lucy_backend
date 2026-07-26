import { LucyErrorCodes } from '../../../core/errors/lucy-error-codes';
import { LucyApiError } from '../../../core/errors/lucy-api.error';
import {
  learningGenerationFailed,
  readLearningGenerationAdviceKey,
} from './learning-generation-failure.error';

describe('learning-generation-failure.error (LEARN-09b)', () => {
  it('attaches adviceKey to LEARNING_GENERATION_FAILED errors', () => {
    const error = learningGenerationFailed(
      'no_retrieval_hits',
      'No retrieval hits available',
    );

    expect(error).toMatchObject({
      statusCode: 502,
      error: LucyErrorCodes.LEARNING_GENERATION_FAILED,
      details: { adviceKey: 'no_retrieval_hits' },
    });
    expect(error.toBody().details).toEqual({ adviceKey: 'no_retrieval_hits' });
  });

  it('reads adviceKey from LucyApiError details', () => {
    const error = new LucyApiError(
      502,
      LucyErrorCodes.LEARNING_GENERATION_FAILED,
      'failed',
      { adviceKey: 'invalid_llm_output' },
    );

    expect(readLearningGenerationAdviceKey(error)).toBe('invalid_llm_output');
    expect(readLearningGenerationAdviceKey(new Error('boom'))).toBe('unknown');
  });
});
