import type { DecodedIdToken } from 'firebase-admin/auth';

/** Local dev token: `Bearer dev:<uid>` (only when `FIREBASE_AUTH_MODE=dev`). */
export function tryParseDevFirebaseToken(
  idToken: string,
): Pick<DecodedIdToken, 'uid'> | null {
  if (!idToken.startsWith('dev:')) {
    return null;
  }

  const uid = idToken.slice('dev:'.length).trim();
  if (!uid || uid.length > 128) {
    return null;
  }

  return { uid };
}
