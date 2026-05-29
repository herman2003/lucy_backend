import { Injectable } from '@nestjs/common';

import type { OnboardingUserDocument } from '../../features/onboarding/repositories/onboarding-user.types';

/** Shared in-process `users/{uid}` documents for `FIRESTORE_PROVIDER=memory`. */
@Injectable()
export class InMemoryUsersStore {
  private readonly users = new Map<string, OnboardingUserDocument>();

  getOrCreate(uid: string): OnboardingUserDocument {
    const existing = this.users.get(uid);
    if (existing) {
      return existing;
    }
    const created: OnboardingUserDocument = {};
    this.users.set(uid, created);
    return created;
  }

  get(uid: string): OnboardingUserDocument | undefined {
    return this.users.get(uid);
  }

  /** Test helper — deep clone of persisted document. */
  cloneDocument(uid: string): OnboardingUserDocument {
    const doc = this.users.get(uid);
    return doc ? structuredClone(doc) : {};
  }
}
