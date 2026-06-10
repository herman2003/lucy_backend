import { Module } from '@nestjs/common';

import { LUCY_CONFIG } from '../../core/config/app-config.module';
import type { LucyConfig } from '../../core/config/lucy-config';
import { LlmModule } from '../../core/llm/llm.module';
import { UsersModule } from '../users/users.module';
import { FirebaseUserRepository } from './repositories/firebase-user.repository';
import { InMemoryOnboardingUsersRepository } from './repositories/in-memory-onboarding-user.repository';
import { ONBOARDING_USERS_REPOSITORY } from './repositories/onboarding-users.repository.port';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './services/onboarding.service';
import { OnboardingQuestionCatalog } from './questions/onboarding-question.catalog';

@Module({
  imports: [LlmModule, UsersModule],
  controllers: [OnboardingController],
  providers: [
    OnboardingService,
    OnboardingQuestionCatalog,
    FirebaseUserRepository,
    InMemoryOnboardingUsersRepository,
    {
      provide: ONBOARDING_USERS_REPOSITORY,
      useFactory: (
        config: LucyConfig,
        firebase: FirebaseUserRepository,
        memory: InMemoryOnboardingUsersRepository,
      ) => (config.firestoreProvider === 'memory' ? memory : firebase),
      inject: [LUCY_CONFIG, FirebaseUserRepository, InMemoryOnboardingUsersRepository],
    },
  ],
})
export class OnboardingModule {}
