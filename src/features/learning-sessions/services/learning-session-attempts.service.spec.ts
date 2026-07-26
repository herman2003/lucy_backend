import { Test, TestingModule } from '@nestjs/testing';

import { LucyErrorCodes } from '../../../core/errors/lucy-error-codes';
import { LucyApiError } from '../../../core/errors/lucy-api.error';
import { InMemoryLearningSessionAttemptsRepository } from '../repositories/in-memory-learning-session-attempts.repository';
import { InMemoryLearningSessionsRepository } from '../repositories/in-memory-learning-sessions.repository';
import { LEARNING_SESSION_ATTEMPTS_REPOSITORY } from '../repositories/learning-session-attempts.repository.port';
import { LEARNING_SESSIONS_REPOSITORY } from '../repositories/learning-sessions.repository.port';
import { LearningSessionAttemptsService } from './learning-session-attempts.service';

const attemptBody = {
  id: 'attempt_1',
  startedAt: '2026-06-10T08:00:00.000Z',
  completedAt: '2026-06-10T08:10:00.000Z',
  scoreCorrect: 3,
  scoreTotal: 5,
  answers: [
    {
      itemId: 'item-1',
      selectedIndex: 0,
      correctIndex: 1,
      isCorrect: false,
    },
  ],
};

describe('LearningSessionAttemptsService (LEARN-12b-V2)', () => {
  let service: LearningSessionAttemptsService;
  let sessionsRepository: InMemoryLearningSessionsRepository;
  let sessionId: string;
  const uid = 'user-1';

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        LearningSessionAttemptsService,
        InMemoryLearningSessionsRepository,
        InMemoryLearningSessionAttemptsRepository,
        {
          provide: LEARNING_SESSIONS_REPOSITORY,
          useExisting: InMemoryLearningSessionsRepository,
        },
        {
          provide: LEARNING_SESSION_ATTEMPTS_REPOSITORY,
          useExisting: InMemoryLearningSessionAttemptsRepository,
        },
      ],
    }).compile();

    service = moduleRef.get(LearningSessionAttemptsService);
    sessionsRepository = moduleRef.get(InMemoryLearningSessionsRepository);
    const created = await sessionsRepository.create(uid, {
      type: 'quiz',
      status: 'ready',
      itemCount: 2,
      title: 'Quiz · thermo',
      createdAt: '2026-05-29T10:00:00.000Z',
      updatedAt: '2026-05-29T10:00:00.000Z',
      activeDocumentCount: 1,
      items: [],
    });
    sessionId = created.id;
  });

  it('records an attempt for an existing session', async () => {
    const saved = await service.recordAttempt(uid, sessionId, attemptBody);

    expect(saved.sessionId).toBe(sessionId);
    expect(saved.scoreCorrect).toBe(3);
  });

  it('lists attempts sorted by completedAt desc', async () => {
    await service.recordAttempt(uid, sessionId, attemptBody);
    await service.recordAttempt(uid, sessionId, {
      ...attemptBody,
      id: 'attempt_2',
      completedAt: '2026-06-11T08:10:00.000Z',
    });

    const attempts = await service.listAttempts(uid, sessionId);

    expect(attempts.map((entry) => entry.id)).toEqual([
      'attempt_2',
      'attempt_1',
    ]);
  });

  it('rejects attempts for unknown sessions', async () => {
    await expect(
      service.recordAttempt(uid, 'missing', attemptBody),
    ).rejects.toMatchObject({
      statusCode: 404,
      error: LucyErrorCodes.LEARNING_SESSION_NOT_FOUND,
    } satisfies Partial<LucyApiError>);
  });
});
