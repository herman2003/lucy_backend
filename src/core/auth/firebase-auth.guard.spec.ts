import type { ExecutionContext } from '@nestjs/common';

import { LucyErrorCodes } from '../errors/lucy-error-codes';
import { LucyApiError } from '../errors/lucy-api.error';
import { FirebaseAuthGuard } from './firebase-auth.guard';
import type { FirebaseAuthService } from './firebase-auth.service';

function createContext(headers: Record<string, string>): ExecutionContext {
  const request: { headers: Record<string, string>; user?: { uid: string } } = {
    headers,
  };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
      getNext: () => ({}),
    }),
  } as ExecutionContext;
}

describe('FirebaseAuthGuard', () => {
  const verifyIdToken = jest.fn();
  const firebaseAuth = { verifyIdToken } as unknown as FirebaseAuthService;
  const guard = new FirebaseAuthGuard(firebaseAuth);

  beforeEach(() => {
    verifyIdToken.mockReset();
  });

  it('rejects when Authorization header is missing', async () => {
    await expect(guard.canActivate(createContext({}))).rejects.toMatchObject({
      error: LucyErrorCodes.UNAUTHORIZED,
      statusCode: 401,
    });
  });

  it('rejects when Bearer token is missing', async () => {
    await expect(
      guard.canActivate(createContext({ authorization: 'Basic x' })),
    ).rejects.toBeInstanceOf(LucyApiError);
  });

  it('rejects when token verification fails', async () => {
    verifyIdToken.mockRejectedValue(new Error('invalid'));
    await expect(
      guard.canActivate(
        createContext({ authorization: 'Bearer bad-token' }),
      ),
    ).rejects.toMatchObject({
      error: LucyErrorCodes.UNAUTHORIZED,
      statusCode: 401,
    });
  });

  it('allows request and attaches uid when token is valid', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'user-123' });
    const ctx = createContext({ authorization: 'Bearer good-token' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(verifyIdToken).toHaveBeenCalledWith('good-token');
    const request = ctx.switchToHttp().getRequest<{ user: { uid: string } }>();
    expect(request.user.uid).toBe('user-123');
  });
});
