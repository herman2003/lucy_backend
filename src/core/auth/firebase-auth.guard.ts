import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

import { LucyErrorCodes } from '../errors/lucy-error-codes';
import { LucyApiError } from '../errors/lucy-api.error';
import { FirebaseAuthService } from './firebase-auth.service';

export type FirebaseAuthRequest = Request & {
  user?: { uid: string };
};

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(private readonly firebaseAuth: FirebaseAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FirebaseAuthRequest>();
    const header = request.headers.authorization;

    if (!header?.startsWith('Bearer ')) {
      throw new LucyApiError(
        401,
        LucyErrorCodes.UNAUTHORIZED,
        'Missing or invalid Authorization header',
      );
    }

    const token = header.slice('Bearer '.length).trim();
    if (!token) {
      throw new LucyApiError(
        401,
        LucyErrorCodes.UNAUTHORIZED,
        'Missing or invalid Authorization header',
      );
    }

    try {
      const decoded = await this.firebaseAuth.verifyIdToken(token);
      request.user = { uid: decoded.uid };
      return true;
    } catch {
      throw new LucyApiError(
        401,
        LucyErrorCodes.UNAUTHORIZED,
        'Invalid or expired token',
      );
    }
  }
}
