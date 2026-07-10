/** gRPC FAILED_PRECONDITION — missing composite / collection-group index. */
const FIRESTORE_FAILED_PRECONDITION = 9;

/** gRPC UNAVAILABLE — network / DNS / service temporarily unreachable. */
const FIRESTORE_UNAVAILABLE = 14;

/** gRPC DEADLINE_EXCEEDED — request timed out. */
const FIRESTORE_DEADLINE_EXCEEDED = 4;

export function isFirestoreMissingIndexError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const code = (error as { code?: number }).code;
  if (code === FIRESTORE_FAILED_PRECONDITION) {
    return true;
  }
  const message = (error as { message?: string }).message;
  return (
    typeof message === 'string' &&
    message.includes('requires') &&
    message.toLowerCase().includes('index')
  );
}

/** Firestore / gRPC errors that may succeed on a later retry (offline, DNS, timeout). */
export function isFirestoreTransientError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const code = (error as { code?: number }).code;
  if (code === FIRESTORE_UNAVAILABLE || code === FIRESTORE_DEADLINE_EXCEEDED) {
    return true;
  }
  const message = (error as { message?: string }).message;
  return (
    typeof message === 'string' &&
    (message.includes('Name resolution failed') ||
      message.includes('ECONNREFUSED') ||
      message.includes('ENOTFOUND') ||
      message.includes('ETIMEDOUT') ||
      message.includes('Deadline exceeded') ||
      message.toLowerCase().includes('unavailable'))
  );
}

/** Firebase often embeds a console URL in `details`. */
export function formatFirestoreIndexHint(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'details' in error) {
    const details = String((error as { details: unknown }).details);
    const urlMatch = details.match(/https:\/\/console\.firebase\.google\.com[^\s]*/);
    if (urlMatch) {
      return urlMatch[0]!;
    }
  }
  return 'Firebase Console → Firestore → Indexes → add the index described in backend/README.md';
}
