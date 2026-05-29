import { LucyErrorCodes } from '../../../core/errors/lucy-error-codes';
import { LucyApiError } from '../../../core/errors/lucy-api.error';

export type CreateUserProfileRequestDto = {
  fullName: string;
  email: string;
  uiLocale?: string;
};

export function parseCreateUserProfileRequest(
  body: unknown,
): CreateUserProfileRequestDto {
  if (!body || typeof body !== 'object') {
    throw validationError('Request body must be an object');
  }

  const record = body as Record<string, unknown>;
  const fullName = record.fullName;
  if (typeof fullName !== 'string' || fullName.trim().length === 0) {
    throw validationError('fullName is required');
  }

  const email = record.email;
  if (typeof email !== 'string' || !email.includes('@')) {
    throw validationError('email must be a valid email string');
  }

  const uiLocale = record.uiLocale;
  if (
    uiLocale !== undefined &&
    (typeof uiLocale !== 'string' || !['fr', 'en', 'de'].includes(uiLocale))
  ) {
    throw validationError('uiLocale must be fr, en, or de when provided');
  }

  return {
    fullName: fullName.trim(),
    email: email.trim(),
    ...(uiLocale !== undefined ? { uiLocale } : {}),
  };
}

function validationError(message: string): LucyApiError {
  return new LucyApiError(400, LucyErrorCodes.VALIDATION_ERROR, message);
}
