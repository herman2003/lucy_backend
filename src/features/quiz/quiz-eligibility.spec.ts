import { Test, TestingModule } from '@nestjs/testing';

import { InMemoryUsersStore } from '../../core/persistence/in-memory-users.store';
import { InMemoryDocumentChunksRepository } from '../documents/repositories/in-memory-document-chunks.repository';
import { InMemoryDocumentsRepository } from '../documents/repositories/in-memory-documents.repository';
import { DOCUMENT_CHUNKS_REPOSITORY } from '../documents/repositories/document-chunks.repository.port';
import { DOCUMENTS_REPOSITORY } from '../documents/repositories/documents.repository.port';
import { DOCUMENTS_STORAGE } from '../documents/storage/documents-storage.port';
import { InMemoryDocumentsStorage } from '../documents/storage/in-memory-documents.storage';
import { InMemoryOnboardingUsersRepository } from '../onboarding/repositories/in-memory-onboarding-user.repository';
import { InMemoryUsersProfileRepository } from '../users/repositories/in-memory-users-profile.repository';
import { USERS_PROFILE_REPOSITORY } from '../users/repositories/users.repository.port';
import { ChatPrerequisitesService } from '../chat/services/chat-prerequisites.service';
import { FirebaseAuthGuard } from '../../core/auth/firebase-auth.guard';
import { FirebaseAuthService } from '../../core/auth/firebase-auth.service';
import { QuizController } from './quiz.controller';
import { QuizService } from './quiz.service';

const validProfile = {
  primary_role: 'student' as const,
  main_domains: ['sciences' as const],
  learning_goal: 'exam' as const,
  self_assessed_level: 'intermediate' as const,
  explanation_style: 'step_by_step' as const,
  feedback_tone: 'encouraging' as const,
  tutoring_language: 'fr' as const,
};

describe('Quiz eligibility (QUIZ-01)', () => {
  let controller: QuizController;
  let documentsRepo: InMemoryDocumentsRepository;
  let onboardingRepo: InMemoryOnboardingUsersRepository;
  const uid = 'dev-user-quiz-eligibility';

  beforeEach(async () => {
    const store = new InMemoryUsersStore();
    onboardingRepo = new InMemoryOnboardingUsersRepository(store);

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [QuizController],
      providers: [
        QuizService,
        ChatPrerequisitesService,
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

    controller = moduleRef.get(QuizController);
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

  it('GET /quizzes/eligibility returns canQuiz false when no active documents', async () => {
    await finalizeUserWithProfile();

    const result = await controller.getEligibility({ user: { uid } } as never);

    expect(result).toEqual({ canQuiz: false, activeDocumentCount: 0 });
  });

  it('GET /quizzes/eligibility returns canQuiz true when a ready searchEnabled doc exists', async () => {
    await finalizeUserWithProfile();
    await seedReadyActiveDocument();

    const result = await controller.getEligibility({ user: { uid } } as never);

    expect(result).toEqual({ canQuiz: true, activeDocumentCount: 1 });
  });
});
