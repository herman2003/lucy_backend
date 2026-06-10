import { Module } from '@nestjs/common';

import { AppConfigModule } from './core/config/app-config.module';
import { FirebaseAdminModule } from './core/auth/firebase-admin.module';
import { EmbeddingModule } from './core/llm/embedding.module';
import { LlmModule } from './core/llm/llm.module';
import { PromptModule } from './core/prompt/prompt.module';
import { UsersModule } from './features/users/users.module';
import { OnboardingModule } from './features/onboarding/onboarding.module';
import { DocumentsModule } from './features/documents/documents.module';
import { RetrievalModule } from './features/retrieval/retrieval.module';
import { ChatModule } from './features/chat/chat.module';
import { QuizModule } from './features/quiz/quiz.module';
import { LearningSessionsModule } from './features/learning-sessions/learning-sessions.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    AppConfigModule,
    FirebaseAdminModule,
    LlmModule,
    EmbeddingModule,
    PromptModule,
    UsersModule,
    OnboardingModule,
    DocumentsModule,
    RetrievalModule,
    ChatModule,
    QuizModule,
    LearningSessionsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
