import { Module } from '@nestjs/common';

import { LUCY_CONFIG } from '../../core/config/app-config.module';
import type { LucyConfig } from '../../core/config/lucy-config';
import { ChatModule } from '../chat/chat.module';
import { UsersModule } from '../users/users.module';
import { FirestoreRevisionReminderPushRepository } from './repositories/firestore-revision-reminder-push.repository';
import { InMemoryRevisionReminderPushRepository } from './repositories/in-memory-revision-reminder-push.repository';
import { REVISION_REMINDER_PUSH_REPOSITORY } from './repositories/revision-reminder-push.repository.port';
import { RevisionRemindersController } from './revision-reminders.controller';
import { FCM_MESSAGING_PORT } from './services/fcm-messaging.port';
import { FirebaseFcmMessagingService } from './services/firebase-fcm-messaging.service';
import { NoopFcmMessagingService } from './services/noop-fcm-messaging.service';
import { RevisionReminderDispatchService } from './services/revision-reminder-dispatch.service';
import { RevisionReminderPushService } from './services/revision-reminder-push.service';

@Module({
  imports: [ChatModule, UsersModule],
  controllers: [RevisionRemindersController],
  providers: [
    RevisionReminderPushService,
    RevisionReminderDispatchService,
    InMemoryRevisionReminderPushRepository,
    FirestoreRevisionReminderPushRepository,
    FirebaseFcmMessagingService,
    NoopFcmMessagingService,
    {
      provide: REVISION_REMINDER_PUSH_REPOSITORY,
      useFactory: (
        config: LucyConfig,
        firestore: FirestoreRevisionReminderPushRepository,
        memory: InMemoryRevisionReminderPushRepository,
      ) => (config.firestoreProvider === 'memory' ? memory : firestore),
      inject: [
        LUCY_CONFIG,
        FirestoreRevisionReminderPushRepository,
        InMemoryRevisionReminderPushRepository,
      ],
    },
    {
      provide: FCM_MESSAGING_PORT,
      useFactory: (
        config: LucyConfig,
        firebase: FirebaseFcmMessagingService,
        noop: NoopFcmMessagingService,
      ) => (config.firestoreProvider === 'memory' ? noop : firebase),
      inject: [LUCY_CONFIG, FirebaseFcmMessagingService, NoopFcmMessagingService],
    },
  ],
})
export class RevisionRemindersModule {}
