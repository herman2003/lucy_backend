import { Test } from '@nestjs/testing';

import { InMemoryUsersStore } from '../../../core/persistence/in-memory-users.store';
import { InMemoryChatsRepository } from '../../chat/repositories/in-memory-chats.repository';
import { CHATS_REPOSITORY } from '../../chat/repositories/chats.repository.port';
import { InMemoryUsersProfileRepository } from '../../users/repositories/in-memory-users-profile.repository';
import { USERS_PROFILE_REPOSITORY } from '../../users/repositories/users.repository.port';
import { InMemoryRevisionReminderPushRepository } from '../repositories/in-memory-revision-reminder-push.repository';
import { REVISION_REMINDER_PUSH_REPOSITORY } from '../repositories/revision-reminder-push.repository.port';
import { FCM_MESSAGING_PORT } from '../services/fcm-messaging.port';
import { NoopFcmMessagingService } from '../services/noop-fcm-messaging.service';
import { RevisionReminderDispatchService } from '../services/revision-reminder-dispatch.service';

describe('RevisionReminderDispatchService', () => {
  let dispatchService: RevisionReminderDispatchService;
  let pushRepository: InMemoryRevisionReminderPushRepository;
  let chatsRepository: InMemoryChatsRepository;
  let fcm: NoopFcmMessagingService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        RevisionReminderDispatchService,
        InMemoryRevisionReminderPushRepository,
        InMemoryChatsRepository,
        InMemoryUsersProfileRepository,
        InMemoryUsersStore,
        NoopFcmMessagingService,
        {
          provide: REVISION_REMINDER_PUSH_REPOSITORY,
          useExisting: InMemoryRevisionReminderPushRepository,
        },
        {
          provide: CHATS_REPOSITORY,
          useExisting: InMemoryChatsRepository,
        },
        {
          provide: USERS_PROFILE_REPOSITORY,
          useExisting: InMemoryUsersProfileRepository,
        },
        {
          provide: FCM_MESSAGING_PORT,
          useExisting: NoopFcmMessagingService,
        },
      ],
    }).compile();

    dispatchService = moduleRef.get(RevisionReminderDispatchService);
    pushRepository = moduleRef.get(InMemoryRevisionReminderPushRepository);
    chatsRepository = moduleRef.get(InMemoryChatsRepository);
    fcm = moduleRef.get(NoopFcmMessagingService);
  });

  it('sends one J-N FCM notification at the user reminder slot', async () => {
    const uid = 'user-1';
    const now = new Date('2026-06-10T16:00:00.000Z');

    await pushRepository.upsertState(uid, {
      fcmTokens: ['token-a'],
      prefs: {
        enabled: true,
        reminderHour: 18,
        reminderMinute: 0,
        revisionPlanEnabled: true,
        timezone: 'Europe/Paris',
      },
    });

    const thread = await chatsRepository.createThread(uid, 'Thermo exam');
    await chatsRepository.patchThread(uid, thread.id, {
      revisionExamDate: '2026-06-13T00:00:00.000Z',
      corpusStudyPlan: {
        generatedAt: '2026-06-10T00:00:00.000Z',
        expiresAt: '2026-06-20T00:00:00.000Z',
        focusAreas: [
          {
            id: 'a1',
            documentId: 'd1',
            documentTitle: 'Thermo',
            label: 'Entropie',
            ordinalStart: 1,
            ordinalEnd: 2,
            importance: 'high',
            rationale: 'r',
            keyConcepts: ['S'],
          },
        ],
      },
    });

    const result = await dispatchService.dispatchDueReminders(now);

    expect(result.sent).toBe(1);
    expect(fcm.sent).toHaveLength(1);
    expect(fcm.sent[0]?.tokens).toEqual(['token-a']);
    expect(fcm.sent[0]?.payload.body).toContain('Entropie');
  });

  it('does not send twice on the same local day', async () => {
    const uid = 'user-1';
    const now = new Date('2026-06-10T16:00:00.000Z');

    await pushRepository.upsertState(uid, {
      fcmTokens: ['token-a'],
      lastJnPushLocalDate: '2026-06-10',
      prefs: {
        enabled: true,
        reminderHour: 18,
        reminderMinute: 0,
        revisionPlanEnabled: true,
        timezone: 'Europe/Paris',
      },
    });

    const thread = await chatsRepository.createThread(uid, 'Thermo exam');
    await chatsRepository.patchThread(uid, thread.id, {
      revisionExamDate: '2026-06-13T00:00:00.000Z',
      corpusStudyPlan: {
        generatedAt: '2026-06-10T00:00:00.000Z',
        expiresAt: '2026-06-20T00:00:00.000Z',
        focusAreas: [
          {
            id: 'a1',
            documentId: 'd1',
            documentTitle: 'Thermo',
            label: 'Entropie',
            ordinalStart: 1,
            ordinalEnd: 2,
            importance: 'high',
            rationale: 'r',
            keyConcepts: ['S'],
          },
        ],
      },
    });

    const result = await dispatchService.dispatchDueReminders(now);

    expect(result.sent).toBe(0);
    expect(fcm.sent).toHaveLength(0);
  });
});
