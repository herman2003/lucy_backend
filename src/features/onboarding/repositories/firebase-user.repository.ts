import { Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin';

import type { LearnerProfile } from '../domain/learner-profile.enums';
import {
  applyConfirmTurn,
  parseTranscript,
  readAnalyzeAttempts,
} from './onboarding-user.store-helpers';
import type {
  AnalyzeUserContext,
  ConfirmTurnParams,
  ConfirmTurnResult,
  OnboardingUserState,
} from './onboarding-user.types';
import type { OnboardingUsersRepository } from './onboarding-users.repository.port';
import { buildOnboardingProgressResponse } from '../dto/onboarding-progress-response.dto';

export type {
  AnalyzeUserContext,
  ConfirmTurnParams,
  ConfirmTurnResult,
  OnboardingUserState,
} from './onboarding-user.types';

@Injectable()
export class FirebaseUserRepository implements OnboardingUsersRepository {
  async getOnboardingState(uid: string): Promise<OnboardingUserState> {
    const data = await this.readUserData(uid);
    const attempts = data.onboardingAttempts;
    const onboardingAttempts =
      attempts && typeof attempts === 'object' && !Array.isArray(attempts)
        ? attempts
        : {};

    return {
      isConfigured: data.isConfigured === true,
      onboardingAttempts,
    };
  }

  async getAnalyzeContext(uid: string): Promise<AnalyzeUserContext> {
    const data = await this.readUserData(uid);
    return {
      isConfigured: data.isConfigured === true,
      onboardingAnalyzeAttempts: readAnalyzeAttempts(data),
      transcript: parseTranscript(data.onboardingTranscript),
    };
  }

  async getProgress(uid: string) {
    const data = await this.readUserData(uid);
    return buildOnboardingProgressResponse(data);
  }

  async incrementValidateAttempt(
    uid: string,
    questionId: string,
  ): Promise<number> {
    const ref = admin.firestore().collection('users').doc(uid);
    return admin.firestore().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.data() ?? {};
      const raw = data.onboardingAttempts;
      const attempts =
        raw && typeof raw === 'object' && !Array.isArray(raw)
          ? { ...(raw as Record<string, number>) }
          : {};
      const next = (attempts[questionId] ?? 0) + 1;
      attempts[questionId] = next;
      tx.set(ref, { onboardingAttempts: attempts }, { merge: true });
      return next;
    });
  }

  async incrementAnalyzeAttempts(uid: string): Promise<number> {
    const ref = admin.firestore().collection('users').doc(uid);
    return admin.firestore().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.data() ?? {};
      const next = readAnalyzeAttempts(data) + 1;
      tx.set(ref, { onboardingAnalyzeAttempts: next }, { merge: true });
      return next;
    });
  }

  async confirmTurn(
    uid: string,
    params: ConfirmTurnParams,
  ): Promise<ConfirmTurnResult> {
    const ref = admin.firestore().collection('users').doc(uid);

    return admin.firestore().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.data() ?? {};
      const result = applyConfirmTurn(data, params);
      tx.set(ref, data, { merge: true });
      return result;
    });
  }

  async saveAnalyzeSuccess(
    uid: string,
    learnerProfile: LearnerProfile,
    summaryForUser: string,
  ): Promise<void> {
    await admin.firestore().collection('users').doc(uid).set(
      {
        pendingLearnerProfile: learnerProfile,
        pendingSummaryForUser: summaryForUser,
        onboardingStatus: 'awaiting_final_confirm',
      },
      { merge: true },
    );
  }

  async finalizeOnboarding(uid: string): Promise<void> {
    const ref = admin.firestore().collection('users').doc(uid);

    await admin.firestore().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.data() ?? {};
      const pendingProfile = data.pendingLearnerProfile;
      if (!pendingProfile || typeof pendingProfile !== 'object') {
        throw new Error('ONBOARDING_PENDING_PROFILE_MISSING');
      }

      const completedAt = new Date().toISOString();
      tx.set(
        ref,
        {
          learnerProfile: pendingProfile,
          isConfigured: true,
          onboardingCompletedAt: completedAt,
          onboardingStatus: 'completed',
          pendingLearnerProfile: admin.firestore.FieldValue.delete(),
          pendingSummaryForUser: admin.firestore.FieldValue.delete(),
        },
        { merge: true },
      );
    });
  }

  private async readUserData(
    uid: string,
  ): Promise<Record<string, unknown> & { onboardingAttempts?: Record<string, number> }> {
    const snapshot = await admin.firestore().collection('users').doc(uid).get();
    if (!snapshot.exists) {
      return {};
    }
    return snapshot.data() ?? {};
  }
}
