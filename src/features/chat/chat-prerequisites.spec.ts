import { Test, TestingModule } from '@nestjs/testing';

import { InMemoryUsersStore } from '../../core/persistence/in-memory-users.store';
import { LucyErrorCodes } from '../../core/errors/lucy-error-codes';
import { InMemoryDocumentChunksRepository } from '../documents/repositories/in-memory-document-chunks.repository';
import { InMemoryDocumentsRepository } from '../documents/repositories/in-memory-documents.repository';
import { DOCUMENT_CHUNKS_REPOSITORY } from '../documents/repositories/document-chunks.repository.port';
import { DOCUMENTS_REPOSITORY } from '../documents/repositories/documents.repository.port';
import { DOCUMENTS_STORAGE } from '../documents/storage/documents-storage.port';
import { InMemoryDocumentsStorage } from '../documents/storage/in-memory-documents.storage';
import { InMemoryOnboardingUsersRepository } from '../onboarding/repositories/in-memory-onboarding-user.repository';
import { InMemoryUsersProfileRepository } from '../users/repositories/in-memory-users-profile.repository';
import { USERS_PROFILE_REPOSITORY } from '../users/repositories/users.repository.port';
import { ChatController } from './chat.controller';
import { ChatPrerequisitesService } from './services/chat-prerequisites.service';
import { InMemoryChatsRepository } from './repositories/in-memory-chats.repository';
import { CHATS_REPOSITORY } from './repositories/chats.repository.port';
import { ChatService } from './services/chat.service';
import { ChatStreamService } from './services/chat-stream.service';
import { FirebaseAuthGuard } from '../../core/auth/firebase-auth.guard';
import { FirebaseAuthService } from '../../core/auth/firebase-auth.service';

const validProfile = {
  primary_role: 'student' as const,
  main_domains: ['sciences' as const],
  learning_goal: 'exam' as const,
  self_assessed_level: 'intermediate' as const,
  explanation_style: 'step_by_step' as const,
  feedback_tone: 'encouraging' as const,
  tutoring_language: 'fr' as const,
};

describe('ChatPrerequisitesService (CHAT-02)', () => {
  let prerequisites: ChatPrerequisitesService;
  let controller: ChatController;
  let documentsRepo: InMemoryDocumentsRepository;
  let onboardingRepo: InMemoryOnboardingUsersRepository;
  const uid = 'dev-user-chat-eligibility';

  beforeEach(async () => {
    const store = new InMemoryUsersStore();
    onboardingRepo = new InMemoryOnboardingUsersRepository(store);

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [
        ChatService,
        {
          provide: ChatStreamService,
          useValue: {
            assertCanStream: jest.fn(),
            streamMessage: jest.fn(),
          },
        },
        ChatPrerequisitesService,
        InMemoryChatsRepository,
        { provide: CHATS_REPOSITORY, useExisting: InMemoryChatsRepository },
        { provide: USERS_PROFILE_REPOSITORY, useValue: new InMemoryUsersProfileRepository(store) },
        InMemoryDocumentsStorage,
        InMemoryDocumentsRepository,
        InMemoryDocumentChunksRepository,
        { provide: DOCUMENTS_STORAGE, useExisting: InMemoryDocumentsStorage },
        { provide: DOCUMENTS_REPOSITORY, useExisting: InMemoryDocumentsRepository },
        {
          provide: DOCUMENT_CHUNKS_REPOSITORY,
          useExisting: InMemoryDocumentChunksRepository,
        },
        { provide: FirebaseAuthService, useValue: { verifyIdToken: jest.fn() } },
      ],
    })
      .overrideGuard(FirebaseAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    prerequisites = moduleRef.get(ChatPrerequisitesService);
    controller = moduleRef.get(ChatController);
    documentsRepo = moduleRef.get(InMemoryDocumentsRepository);
  });

  async function finalizeUserWithProfile(): Promise<void> {
    await onboardingRepo.saveAnalyzeSuccess(uid, validProfile, 'Résumé.');
    await onboardingRepo.finalizeOnboarding(uid);
  }

  async function seedReadyActiveDocument(): Promise<void> {
    const doc = await documentsRepo.create(uid, {
      title: 'Cours',
      fileName: 'c.txt',
      mimeType: 'text/plain',
      byteSize: 10,
    });
    await documentsRepo.updateStatus(uid, doc.id, 'ready');
    await documentsRepo.setSearchEnabled(uid, doc.id, true);
  }

  it('GET /chats/eligibility returns canChat false when no active documents', async () => {
    await finalizeUserWithProfile();

    const result = await controller.getEligibility({ user: { uid } } as never);

    expect(result).toEqual({ canChat: false, activeDocumentCount: 0 });
    expect(result).not.toHaveProperty('learnerProfile');
  });

  it('GET /chats/eligibility returns canChat true when a ready searchEnabled doc exists', async () => {
    await finalizeUserWithProfile();
    await seedReadyActiveDocument();

    const result = await controller.getEligibility({ user: { uid } } as never);

    expect(result).toEqual({ canChat: true, activeDocumentCount: 1 });
  });

  it('requireLearnerProfile returns profile when onboarding finalized', async () => {
    await finalizeUserWithProfile();

    const profile = await prerequisites.requireLearnerProfile(uid);

    expect(profile.tutoring_language).toBe('fr');
  });

  it('requireLearnerProfile throws CHAT_LEARNER_PROFILE_MISSING without profile', async () => {
    await expect(prerequisites.requireLearnerProfile(uid)).rejects.toMatchObject({
      statusCode: 409,
      error: LucyErrorCodes.CHAT_LEARNER_PROFILE_MISSING,
    });
  });

  it('requireActiveDocuments throws CHAT_NO_ACTIVE_DOCUMENTS when corpus empty', async () => {
    await finalizeUserWithProfile();

    await expect(prerequisites.requireActiveDocuments(uid)).rejects.toMatchObject({
      error: LucyErrorCodes.CHAT_NO_ACTIVE_DOCUMENTS,
    });
  });
});
