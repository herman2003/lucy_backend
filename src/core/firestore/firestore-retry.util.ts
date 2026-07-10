import type { Logger } from '@nestjs/common';

import { isFirestoreTransientError } from './firestore-index.util';

const DEFAULT_MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 500;

export type FirestoreRetryOptions = {
  maxAttempts?: number;
  logger?: Logger;
  label?: string;
};

/** Retries Firestore operations on transient gRPC errors (timeout, DNS, unavailable). */
export async function withFirestoreRetry<T>(
  operation: () => Promise<T>,
  options: FirestoreRetryOptions = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const canRetry = isFirestoreTransientError(error) && attempt < maxAttempts;
      if (!canRetry) {
        throw error;
      }
      const delayMs = BASE_DELAY_MS * attempt;
      options.logger?.warn(
        `${options.label ?? 'Firestore'} attempt ${attempt}/${maxAttempts} failed (transient). Retrying in ${delayMs}ms.`,
      );
      await sleep(delayMs);
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
