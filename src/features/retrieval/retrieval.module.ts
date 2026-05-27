import { Module } from '@nestjs/common';

import { EmbeddingModule } from '../../core/llm/embedding.module';
import { DocumentsModule } from '../documents/documents.module';
import { RetrievalController } from './retrieval.controller';
import { RetrievalService } from './services/retrieval.service';

@Module({
  imports: [DocumentsModule, EmbeddingModule],
  controllers: [RetrievalController],
  providers: [RetrievalService],
  exports: [RetrievalService],
})
export class RetrievalModule {}
