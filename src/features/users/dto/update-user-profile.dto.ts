import { LucyErrorCodes } from '../../../core/errors/lucy-error-codes';
import { LucyApiError } from '../../../core/errors/lucy-api.error';

export type UpdateUserProfileInput = {
  fullName?: string;
  uiLocale?: string;
};

export function parseUpdateUserProfileRequest(
  body: unknown,
): UpdateUserProfileInput {
  if (!body || typeof body !== 'object') {
    throw validationError('Body must be an object');
  }

  const record = body as Record<string, unknown>;
  const result: UpdateUserProfileInput = {};

  if ('fullName' in record) {
    if (typeof record.fullName !== 'string' || record.fullName.trim().length < 2) {
      throw validationError('fullName must be a string with at least 2 characters');
    }
    result.fullName = record.fullName.trim();
  }

  if ('uiLocale' in record) {
    const uiLocale = record.uiLocale;
    if (
      typeof uiLocale !== 'string' ||
      !['fr', 'en', 'de'].includes(uiLocale)
    ) {
      throw validationError('uiLocale must be fr, en, or de');
    }
    result.uiLocale = uiLocale;
  }

  if (result.fullName === undefined && result.uiLocale === undefined) {
    throw validationError('At least one of fullName or uiLocale is required');
  }

  return result;
}

function validationError(message: string): LucyApiError {
  return new LucyApiError(400, LucyErrorCodes.VALIDATION_ERROR, message);
}
