import { Module, forwardRef } from '@nestjs/common';

import { LUCY_CONFIG } from '../../core/config/app-config.module';
import type { LucyConfig } from '../../core/config/lucy-config';
import { LlmModule } from '../../core/llm/llm.module';
import { PromptModule } from '../../core/prompt/prompt.module';
import { ChatModule } from '../chat/chat.module';
import { RetrievalModule } from '../retrieval/retrieval.module';
import { LearningSessionsController } from './learning-sessions.controller';
import { FirestoreLearningSessionsRepository } from './repositories/firestore-learning-sessions.repository';
import { InMemoryLearningSessionsRepository } from './repositories/in-memory-learning-sessions.repository';
import { LEARNING_SESSIONS_REPOSITORY } from './repositories/learning-sessions.repository.port';
import { LearningSessionsService } from './services/learning-sessions.service';
import { CorpusStudyAnalyzerService } from './services/corpus-study-analyzer.service';

@Module({
  imports: [forwardRef(() => ChatModule), RetrievalModule, LlmModule, PromptModule],
  controllers: [LearningSessionsController],
  providers: [
    LearningSessionsService,
    CorpusStudyAnalyzerService,
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
  exports: [LearningSessionsService, CorpusStudyAnalyzerService, LEARNING_SESSIONS_REPOSITORY],
})
export class LearningSessionsModule {}
