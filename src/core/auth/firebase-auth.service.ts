import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';
import type { DecodedIdToken } from 'firebase-admin/auth';

import { LUCY_CONFIG } from '../config/app-config.module';
import type { LucyConfig } from '../config/lucy-config';
import { tryParseDevFirebaseToken } from './dev-firebase-token';

@Injectable()
export class FirebaseAuthService implements OnModuleInit {
  private initialized = false;

  constructor(@Inject(LUCY_CONFIG) private readonly config: LucyConfig) {}

  onModuleInit(): void {
    this.ensureApp();
  }

  async verifyIdToken(idToken: string): Promise<DecodedIdToken> {
    if (this.config.firebaseAuthMode === 'dev') {
      const dev = tryParseDevFirebaseToken(idToken);
      if (dev) {
        return dev as DecodedIdToken;
      }
    }

    this.ensureApp();
    return admin.auth().verifyIdToken(idToken);
  }

  private ensureApp(): void {
    if (this.initialized || admin.apps.length > 0) {
      this.initialized = true;
      return;
    }

    admin.initializeApp({
      projectId: this.config.firebaseProjectId,
    });
    this.initialized = true;
  }
}
