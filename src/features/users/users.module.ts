import { Module } from '@nestjs/common';

import { LUCY_CONFIG } from '../../core/config/app-config.module';
import type { LucyConfig } from '../../core/config/lucy-config';
import { InMemoryUsersStore } from '../../core/persistence/in-memory-users.store';
import { FirebaseUsersProfileRepository } from './repositories/firebase-users-profile.repository';
import { InMemoryUsersProfileRepository } from './repositories/in-memory-users-profile.repository';
import { USERS_PROFILE_REPOSITORY } from './repositories/users.repository.port';
import { UsersController } from './users.controller';
import { UsersService } from './services/users.service';

@Module({
  controllers: [UsersController],
  providers: [
    UsersService,
    InMemoryUsersStore,
    FirebaseUsersProfileRepository,
    InMemoryUsersProfileRepository,
    {
      provide: USERS_PROFILE_REPOSITORY,
      useFactory: (
        config: LucyConfig,
        firebase: FirebaseUsersProfileRepository,
        memory: InMemoryUsersProfileRepository,
      ) => (config.firestoreProvider === 'memory' ? memory : firebase),
      inject: [
        LUCY_CONFIG,
        FirebaseUsersProfileRepository,
        InMemoryUsersProfileRepository,
      ],
    },
  ],
  exports: [InMemoryUsersStore, USERS_PROFILE_REPOSITORY],
})
export class UsersModule {}
