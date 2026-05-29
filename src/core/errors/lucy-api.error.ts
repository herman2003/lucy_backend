import type { LucyErrorCode } from './lucy-error-codes';

export type LucyApiErrorBody = {
  statusCode: number;
  error: LucyErrorCode;
  message: string;
  details?: Record<string, unknown>;
};

export class LucyApiError extends Error {
  readonly statusCode: number;
  readonly error: LucyErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    statusCode: number,
    error: LucyErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'LucyApiError';
    this.statusCode = statusCode;
    this.error = error;
    this.details = details;
  }

  toBody(): LucyApiErrorBody {
    const body: LucyApiErrorBody = {
      statusCode: this.statusCode,
      error: this.error,
      message: this.message,
    };
    if (this.details !== undefined) {
      body.details = this.details;
    }
    return body;
  }
}
