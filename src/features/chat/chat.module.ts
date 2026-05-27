import { Module } from '@nestjs/common';

import { ChatController } from './chat.controller';
import { InMemoryChatsRepository } from './repositories/in-memory-chats.repository';
import { CHATS_REPOSITORY } from './repositories/chats.repository.port';
import { ChatService } from './services/chat.service';

@Module({
  controllers: [ChatController],
  providers: [
    ChatService,
    InMemoryChatsRepository,
    {
      provide: CHATS_REPOSITORY,
      useExisting: InMemoryChatsRepository,
    },
  ],
  exports: [ChatService, CHATS_REPOSITORY],
})
export class ChatModule {}
