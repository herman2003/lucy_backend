import { Module } from '@nestjs/common';

import { LUCY_CONFIG } from '../../core/config/app-config.module';
import type { LucyConfig } from '../../core/config/lucy-config';
import { DocumentsModule } from '../documents/documents.module';
import { UsersModule } from '../users/users.module';
import { ChatController } from './chat.controller';
import { FirestoreChatsRepository } from './repositories/firestore-chats.repository';
import { InMemoryChatsRepository } from './repositories/in-memory-chats.repository';
import { CHATS_REPOSITORY } from './repositories/chats.repository.port';
import { ChatPrerequisitesService } from './services/chat-prerequisites.service';
import { ChatService } from './services/chat.service';

@Module({
  imports: [DocumentsModule, UsersModule],
  controllers: [ChatController],
  providers: [
    ChatService,
    ChatPrerequisitesService,
    InMemoryChatsRepository,
    FirestoreChatsRepository,
    {
      provide: CHATS_REPOSITORY,
      useFactory: (
        config: LucyConfig,
        firestore: FirestoreChatsRepository,
        memory: InMemoryChatsRepository,
      ) => (config.firestoreProvider === 'memory' ? memory : firestore),
      inject: [LUCY_CONFIG, FirestoreChatsRepository, InMemoryChatsRepository],
    },
  ],
  exports: [ChatService, ChatPrerequisitesService, CHATS_REPOSITORY],
})
export class ChatModule {}
