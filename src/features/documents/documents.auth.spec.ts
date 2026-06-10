import { FirebaseAuthGuard } from '../../core/auth/firebase-auth.guard';
import type { FirebaseAuthRequest } from '../../core/auth/firebase-auth.guard';
import { LucyApiError } from '../../core/errors/lucy-api.error';
import { LucyErrorCodes } from '../../core/errors/lucy-error-codes';

describe('Documents auth (FirebaseAuthGuard)', () => {
  it('throws UNAUTHORIZED with expected body shape when header missing', async () => {
    const guard = new FirebaseAuthGuard({
      verifyIdToken: async () => ({ uid: 'x' }),
    } as never);

    await expect(
      guard.canActivate({
        switchToHttp: () => ({
          getRequest: () => ({ headers: {} } as FirebaseAuthRequest),
        }),
      } as never),
    ).rejects.toEqual(
      new LucyApiError(
        401,
        LucyErrorCodes.UNAUTHORIZED,
        'Missing or invalid Authorization header',
      ),
    );
  });
});

