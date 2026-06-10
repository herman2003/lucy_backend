import { Module } from '@nestjs/common';

import { LUCY_CONFIG } from '../../core/config/app-config.module';
import type { LucyConfig } from '../../core/config/lucy-config';
import { FirestoreLearningSessionsRepository } from './repositories/firestore-learning-sessions.repository';
import { InMemoryLearningSessionsRepository } from './repositories/in-memory-learning-sessions.repository';
import { LEARNING_SESSIONS_REPOSITORY } from './repositories/learning-sessions.repository.port';

@Module({
  providers: [
    InMemoryLearningSessionsRepository,
    FirestoreLearningSessionsRepository,
    {
      provide: LEARNING_SESSIONS_REPOSITORY,
      useFactory: (
        config: LucyConfig,
        firestore: FirestoreLearningSessionsRepository,
        memory: InMemoryLearningSessionsRepository,
      ) => (config.firestoreProvider === 'memory' ? memory : firestore),
      inject: [
        LUCY_CONFIG,
        FirestoreLearningSessionsRepository,
        InMemoryLearningSessionsRepository,
      ],
    },
  ],
  exports: [LEARNING_SESSIONS_REPOSITORY],
})
export class LearningSessionsModule {}
