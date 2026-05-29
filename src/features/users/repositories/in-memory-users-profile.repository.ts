import { Injectable } from '@nestjs/common';

import { InMemoryUsersStore } from '../../../core/persistence/in-memory-users.store';
import type {
  UpsertUserProfileInput,
  UpsertUserProfileResult,
  UsersProfileRepository,
} from './users.repository.port';

@Injectable()
export class InMemoryUsersProfileRepository implements UsersProfileRepository {
  constructor(private readonly store: InMemoryUsersStore) {}

  async getProfile(uid: string): Promise<Record<string, unknown> | null> {
    const doc = this.store.get(uid);
    if (!doc) {
      return null;
    }
    return { ...doc };
  }

  async upsertProfile(
    uid: string,
    input: UpsertUserProfileInput,
  ): Promise<UpsertUserProfileResult> {
    const existingDoc = this.store.get(uid);
    const existing = existingDoc ? { ...existingDoc } : null;

    if (existing) {
      this.assertNoEmailConflict(existing, input.email);
    }

    if (existing?.fullName && typeof existing.fullName === 'string') {
      const doc = this.store.getOrCreate(uid);
      if (input.uiLocale !== undefined) {
        doc.uiLocale = input.uiLocale;
      }
      return { created: false, profile: { ...doc } };
    }

    const createdAt = new Date().toISOString();
    const doc = this.store.getOrCreate(uid);
    doc.fullName = input.fullName;
    doc.email = input.email;
    doc.createdAt = createdAt;
    doc.isConfigured = false;
    doc.onboardingStatus = 'not_started';
    if (input.uiLocale !== undefined) {
      doc.uiLocale = input.uiLocale;
    }

    return { created: true, profile: { ...doc } };
  }

  private assertNoEmailConflict(
    existing: Record<string, unknown>,
    email: string,
  ): void {
    const storedEmail = existing.email;
    if (
      typeof storedEmail === 'string' &&
      storedEmail.length > 0 &&
      storedEmail !== email
    ) {
      throw new Error('USER_PROFILE_CONFLICT');
    }
  }
}
