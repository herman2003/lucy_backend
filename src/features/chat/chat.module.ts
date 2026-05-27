import { Module } from '@nestjs/common';

import { LUCY_CONFIG } from '../../core/config/app-config.module';
import type { LucyConfig } from '../../core/config/lucy-config';
import { LlmModule } from '../../core/llm/llm.module';
import { PromptModule } from '../../core/prompt/prompt.module';
import { DocumentsModule } from '../documents/documents.module';
import { RetrievalModule } from '../retrieval/retrieval.module';
import { UsersModule } from '../users/users.module';
import { ChatController } from './chat.controller';
import { FirestoreChatsRepository } from './repositories/firestore-chats.repository';
import { InMemoryChatsRepository } from './repositories/in-memory-chats.repository';
import { CHATS_REPOSITORY } from './repositories/chats.repository.port';
import { ChatPrerequisitesService } from './services/chat-prerequisites.service';
import { ChatRagService } from './services/chat-rag.service';
import { ChatService } from './services/chat.service';
import { ChatStreamService } from './services/chat-stream.service';

@Module({
  imports: [DocumentsModule, UsersModule, LlmModule, PromptModule, RetrievalModule],
  controllers: [ChatController],
  providers: [
    ChatService,
    ChatStreamService,
    ChatRagService,
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
