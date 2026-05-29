import { LucyErrorCodes } from '../../../core/errors/lucy-error-codes';
import { LucyApiError } from '../../../core/errors/lucy-api.error';

export type FinalizeRequestDto = {
  accept: boolean;
};

export function parseFinalizeRequest(body: unknown): FinalizeRequestDto {
  if (!body || typeof body !== 'object') {
    throw validationError('Request body must be an object');
  }

  const accept = (body as Record<string, unknown>).accept;
  if (accept !== true) {
    throw validationError('accept must be true to finalize onboarding');
  }

  return { accept: true };
}

function validationError(message: string): LucyApiError {
  return new LucyApiError(400, LucyErrorCodes.VALIDATION_ERROR, message);
}
