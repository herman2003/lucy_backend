import { Module } from '@nestjs/common';

import { EmbeddingModule } from '../../core/llm/embedding.module';
import { LUCY_CONFIG } from '../../core/config/app-config.module';
import type { LucyConfig } from '../../core/config/lucy-config';
import { DocumentsController } from './documents.controller';
import { FirestoreDocumentsRepository } from './repositories/firestore-documents.repository';
import { InMemoryDocumentsRepository } from './repositories/in-memory-documents.repository';
import { DOCUMENT_CHUNKS_REPOSITORY } from './repositories/document-chunks.repository.port';
import { FirestoreDocumentChunksRepository } from './repositories/firestore-document-chunks.repository';
import { InMemoryDocumentChunksRepository } from './repositories/in-memory-document-chunks.repository';
import { DOCUMENTS_REPOSITORY } from './repositories/documents.repository.port';
import { DocumentChunkingService } from './services/document-chunking.service';
import { DocumentIngestionService } from './services/document-ingestion.service';
import { DocumentTextExtractorService } from './services/document-text-extractor.service';
import { DocumentUploadSweeperService } from './services/document-upload-sweeper.service';
import { DocumentsService } from './services/documents.service';
import { FirebaseDocumentsStorage } from './storage/firebase-documents.storage';
import { InMemoryDocumentsStorage } from './storage/in-memory-documents.storage';
import { R2DocumentsStorage } from './storage/r2-documents.storage';
import { DOCUMENTS_STORAGE } from './storage/documents-storage.port';

@Module({
  imports: [EmbeddingModule],
  controllers: [DocumentsController],
  exports: [DOCUMENTS_REPOSITORY, DOCUMENT_CHUNKS_REPOSITORY],
  providers: [
    DocumentTextExtractorService,
    DocumentChunkingService,
    DocumentIngestionService,
    DocumentUploadSweeperService,
    DocumentsService,
    InMemoryDocumentsRepository,
    FirestoreDocumentsRepository,
    InMemoryDocumentChunksRepository,
    FirestoreDocumentChunksRepository,
    InMemoryDocumentsStorage,
    FirebaseDocumentsStorage,
    R2DocumentsStorage,
    {
      provide: DOCUMENTS_REPOSITORY,
      useFactory: (
        config: LucyConfig,
        firestore: FirestoreDocumentsRepository,
        memory: InMemoryDocumentsRepository,
      ) => (config.firestoreProvider === 'memory' ? memory : firestore),
      inject: [LUCY_CONFIG, FirestoreDocumentsRepository, InMemoryDocumentsRepository],
    },
    {
      provide: DOCUMENTS_STORAGE,
      useFactory: (
        config: LucyConfig,
        firebase: FirebaseDocumentsStorage,
        r2: R2DocumentsStorage,
        memory: InMemoryDocumentsStorage,
      ) => {
        if (config.firestoreProvider === 'memory') {
          return memory;
        }
        if (config.storageProvider === 'r2') {
          return r2;
        }
        return firebase;
      },
      inject: [
        LUCY_CONFIG,
        FirebaseDocumentsStorage,
        R2DocumentsStorage,
        InMemoryDocumentsStorage,
      ],
    },
    {
      provide: DOCUMENT_CHUNKS_REPOSITORY,
      useFactory: (
        config: LucyConfig,
        firestore: FirestoreDocumentChunksRepository,
        memory: InMemoryDocumentChunksRepository,
      ) => (config.firestoreProvider === 'memory' ? memory : firestore),
      inject: [
        LUCY_CONFIG,
        FirestoreDocumentChunksRepository,
        InMemoryDocumentChunksRepository,
      ],
    },
  ],
})
export class DocumentsModule {}
