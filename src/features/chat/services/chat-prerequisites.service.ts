import { Inject, Injectable } from '@nestjs/common';

import { LucyErrorCodes } from '../../../core/errors/lucy-error-codes';
import { LucyApiError } from '../../../core/errors/lucy-api.error';
import type { LearnerProfile } from '../../onboarding/domain/learner-profile.enums';
import { parseLearnerProfile } from '../../onboarding/validators/analyze-response.validator';
import {
  DOCUMENTS_REPOSITORY,
  type DocumentsRepository,
} from '../../documents/repositories/documents.repository.port';
import {
  USERS_PROFILE_REPOSITORY,
  type UsersProfileRepository,
} from '../../users/repositories/users.repository.port';
import type { ChatEligibilityDto } from '../dto/chat-eligibility.dto';

@Injectable()
export class ChatPrerequisitesService {
  constructor(
    @Inject(USERS_PROFILE_REPOSITORY)
    private readonly usersRepository: UsersProfileRepository,
    @Inject(DOCUMENTS_REPOSITORY)
    private readonly documentsRepository: DocumentsRepository,
  ) {}

  async getEligibility(uid: string): Promise<ChatEligibilityDto> {
    const activeDocumentCount = await this.countActiveSearchReadyDocuments(uid);
    return {
      canChat: activeDocumentCount > 0,
      activeDocumentCount,
    };
  }

  async requireLearnerProfile(uid: string): Promise<LearnerProfile> {
    const doc = await this.usersRepository.getProfile(uid);
    if (doc?.isConfigured !== true) {
      throw learnerProfileMissing();
    }

    try {
      return parseLearnerProfile(doc.learnerProfile);
    } catch {
      throw learnerProfileMissing();
    }
  }

  async requireActiveDocuments(uid: string): Promise<void> {
    const count = await this.countActiveSearchReadyDocuments(uid);
    if (count === 0) {
      throw new LucyApiError(
        409,
        LucyErrorCodes.CHAT_NO_ACTIVE_DOCUMENTS,
        'No active documents for chat',
      );
    }
  }

  async listActiveDocuments(uid: string): Promise<Array<{ id: string; title: string }>> {
    const documents = await this.documentsRepository.list(uid);
    return documents
      .filter((doc) => doc.status === 'ready' && doc.searchEnabled === true)
      .map((doc) => ({ id: doc.id, title: doc.title }));
  }

  private async countActiveSearchReadyDocuments(uid: string): Promise<number> {
    const documents = await this.documentsRepository.list(uid);
    return documents.filter(
      (doc) => doc.status === 'ready' && doc.searchEnabled === true,
    ).length;
  }
}

function learnerProfileMissing(): LucyApiError {
  return new LucyApiError(
    409,
    LucyErrorCodes.CHAT_LEARNER_PROFILE_MISSING,
    'Learner profile is missing or onboarding is incomplete',
  );
}
