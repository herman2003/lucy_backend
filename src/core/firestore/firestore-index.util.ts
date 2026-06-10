/** gRPC FAILED_PRECONDITION — missing composite / collection-group index. */
const FIRESTORE_FAILED_PRECONDITION = 9;

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
