import { Injectable } from '@nestjs/common';

import { InMemoryUsersStore } from '../../../core/persistence/in-memory-users.store';
import type { LearnerProfile } from '../domain/learner-profile.enums';
import {
  applyConfirmTurn,
  parseTranscript,
  readAnalyzeAttempts,
} from './onboarding-user.store-helpers';
import { buildOnboardingProgressResponse } from '../dto/onboarding-progress-response.dto';
import type {
  AnalyzeUserContext,
  ConfirmTurnParams,
  ConfirmTurnResult,
  OnboardingUserDocument,
  OnboardingUserState,
} from './onboarding-user.types';
import type { OnboardingUsersRepository } from './onboarding-users.repository.port';

/** In-process user store for local dev (`FIRESTORE_PROVIDER=memory`). */
@Injectable()
export class InMemoryOnboardingUsersRepository
  implements OnboardingUsersRepository
{
  constructor(private readonly store: InMemoryUsersStore) {}

  async getOnboardingState(uid: string): Promise<OnboardingUserState> {
    const data = this.store.getOrCreate(uid);
    const attempts = data.onboardingAttempts ?? {};
    return {
      isConfigured: data.isConfigured === true,
      onboardingAttempts: { ...attempts },
    };
  }

  async getAnalyzeContext(uid: string): Promise<AnalyzeUserContext> {
    const data = this.store.getOrCreate(uid);
    return {
      isConfigured: data.isConfigured === true,
      onboardingAnalyzeAttempts: readAnalyzeAttempts(data),
      transcript: parseTranscript(data.onboardingTranscript),
    };
  }

  async getProgress(uid: string) {
    const data = this.store.getOrCreate(uid);
    return buildOnboardingProgressResponse(data);
  }

  async incrementValidateAttempt(uid: string, questionId: string): Promise<number> {
    const data = this.store.getOrCreate(uid);
    const attempts = { ...(data.onboardingAttempts ?? {}) };
    const next = (attempts[questionId] ?? 0) + 1;
    attempts[questionId] = next;
    data.onboardingAttempts = attempts;
    return next;
  }

  async incrementAnalyzeAttempts(uid: string): Promise<number> {
    const data = this.store.getOrCreate(uid);
    const next = readAnalyzeAttempts(data) + 1;
    data.onboardingAnalyzeAttempts = next;
    return next;
  }

  async confirmTurn(
    uid: string,
    params: ConfirmTurnParams,
  ): Promise<ConfirmTurnResult> {
    const data = this.store.getOrCreate(uid);
    const result = applyConfirmTurn(data, params);
    return result;
  }

  async saveAnalyzeSuccess(
    uid: string,
    learnerProfile: LearnerProfile,
    summaryForUser: string,
  ): Promise<void> {
    const data = this.store.getOrCreate(uid);
    data.pendingLearnerProfile = learnerProfile;
    data.pendingSummaryForUser = summaryForUser;
    data.onboardingStatus = 'awaiting_final_confirm';
  }

  async finalizeOnboarding(uid: string): Promise<void> {
    const data = this.store.getOrCreate(uid);
    const pendingProfile = data.pendingLearnerProfile;
    if (!pendingProfile) {
      throw new Error('ONBOARDING_PENDING_PROFILE_MISSING');
    }

    data.learnerProfile = pendingProfile;
    data.isConfigured = true;
    data.onboardingCompletedAt = new Date().toISOString();
    data.onboardingStatus = 'completed';
    delete data.pendingLearnerProfile;
    delete data.pendingSummaryForUser;
  }

  /** Test helper — read persisted document. */
  getDocument(uid: string): OnboardingUserDocument {
    return this.store.cloneDocument(uid);
  }
}

/** Convenience for unit tests — isolated in-memory store per call. */
export function createInMemoryOnboardingUsersRepository(): InMemoryOnboardingUsersRepository {
  return new InMemoryOnboardingUsersRepository(new InMemoryUsersStore());
}
