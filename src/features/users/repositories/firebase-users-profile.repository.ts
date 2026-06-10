import { Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin';

import type { LearnerProfile } from '../../onboarding/domain/learner-profile.enums';
import type {
  UpdateUserProfilePatch,
  UpsertUserProfileInput,
  UpsertUserProfileResult,
  UsersProfileRepository,
} from './users.repository.port';

@Injectable()
export class FirebaseUsersProfileRepository implements UsersProfileRepository {
  async getProfile(uid: string): Promise<Record<string, unknown> | null> {
    const snapshot = await admin.firestore().collection('users').doc(uid).get();
    if (!snapshot.exists) {
      return null;
    }
    return snapshot.data() ?? null;
  }

  async upsertProfile(
    uid: string,
    input: UpsertUserProfileInput,
  ): Promise<UpsertUserProfileResult> {
    const ref = admin.firestore().collection('users').doc(uid);
    const snapshot = await ref.get();
    const existing = snapshot.data() ?? null;

    if (existing) {
      this.assertNoEmailConflict(existing, input.email);
    }

    if (existing?.fullName && typeof existing.fullName === 'string') {
      const patch: Record<string, unknown> = {};
      if (input.uiLocale !== undefined) {
        patch.uiLocale = input.uiLocale;
      }
      if (Object.keys(patch).length > 0) {
        await ref.set(patch, { merge: true });
      }
      const merged = { ...existing, ...patch };
      return { created: false, profile: merged };
    }

    const createdAt = new Date().toISOString();
    const profile: Record<string, unknown> = {
      fullName: input.fullName,
      email: input.email,
      createdAt,
      isConfigured: false,
      onboardingStatus: 'not_started',
      ...(input.uiLocale !== undefined ? { uiLocale: input.uiLocale } : {}),
    };

    await ref.set(profile, { merge: true });
    return { created: true, profile };
  }

  async updateLearnerProfile(
    uid: string,
    learnerProfile: LearnerProfile,
  ): Promise<Record<string, unknown>> {
    const ref = admin.firestore().collection('users').doc(uid);
    await ref.set({ learnerProfile }, { merge: true });
    const snapshot = await ref.get();
    return snapshot.data() ?? {};
  }

  async updateProfile(
    uid: string,
    patch: UpdateUserProfilePatch,
  ): Promise<Record<string, unknown>> {
    const ref = admin.firestore().collection('users').doc(uid);
    const data: Record<string, unknown> = {};
    if (patch.fullName !== undefined) {
      data.fullName = patch.fullName;
    }
    if (patch.uiLocale !== undefined) {
      data.uiLocale = patch.uiLocale;
    }
    await ref.set(data, { merge: true });
    const snapshot = await ref.get();
    return snapshot.data() ?? {};
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
