import { Module } from '@nestjs/common';

import { DocumentsModule } from '../documents/documents.module';
import { UsersModule } from '../users/users.module';
import { ChatController } from './chat.controller';
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
    {
      provide: CHATS_REPOSITORY,
      useExisting: InMemoryChatsRepository,
    },
  ],
  exports: [ChatService, ChatPrerequisitesService, CHATS_REPOSITORY],
})
export class ChatModule {}
