import { Module, forwardRef } from '@nestjs/common';

import { LUCY_CONFIG } from '../../core/config/app-config.module';
import type { LucyConfig } from '../../core/config/lucy-config';
import { LlmModule } from '../../core/llm/llm.module';
import { PromptModule } from '../../core/prompt/prompt.module';
import { DocumentsModule } from '../documents/documents.module';
import { ChatModule } from '../chat/chat.module';
import { RetrievalModule } from '../retrieval/retrieval.module';
import { LearningSessionsController } from './learning-sessions.controller';
import { LearningSessionAttemptsController } from './learning-session-attempts.controller';
import { FirestoreLearningSessionsRepository } from './repositories/firestore-learning-sessions.repository';
import { FirestoreLearningSessionAttemptsRepository } from './repositories/firestore-learning-session-attempts.repository';
import { InMemoryLearningSessionsRepository } from './repositories/in-memory-learning-sessions.repository';
import { InMemoryLearningSessionAttemptsRepository } from './repositories/in-memory-learning-session-attempts.repository';
import { LEARNING_SESSIONS_REPOSITORY } from './repositories/learning-sessions.repository.port';
import { LEARNING_SESSION_ATTEMPTS_REPOSITORY } from './repositories/learning-session-attempts.repository.port';
import { LearningSessionsService } from './services/learning-sessions.service';
import { LearningSessionAttemptsService } from './services/learning-session-attempts.service';
import { CorpusStudyAnalyzerService } from './services/corpus-study-analyzer.service';

@Module({
  imports: [
    forwardRef(() => ChatModule),
    DocumentsModule,
    RetrievalModule,
    LlmModule,
    PromptModule,
  ],
  controllers: [LearningSessionsController, LearningSessionAttemptsController],
  providers: [
    LearningSessionsService,
    LearningSessionAttemptsService,
    CorpusStudyAnalyzerService,
    InMemoryLearningSessionsRepository,
    InMemoryLearningSessionAttemptsRepository,
    FirestoreLearningSessionsRepository,
    FirestoreLearningSessionAttemptsRepository,
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
    {
      provide: LEARNING_SESSION_ATTEMPTS_REPOSITORY,
      useFactory: (
        config: LucyConfig,
        firestore: FirestoreLearningSessionAttemptsRepository,
        memory: InMemoryLearningSessionAttemptsRepository,
      ) => (config.firestoreProvider === 'memory' ? memory : firestore),
      inject: [
        LUCY_CONFIG,
        FirestoreLearningSessionAttemptsRepository,
        InMemoryLearningSessionAttemptsRepository,
      ],
    },
  ],
  exports: [
    LearningSessionsService,
    LearningSessionAttemptsService,
    CorpusStudyAnalyzerService,
    LEARNING_SESSIONS_REPOSITORY,
  ],
})
export class LearningSessionsModule {}
