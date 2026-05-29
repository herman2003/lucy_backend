import { EMBEDDING_PORT } from '../../../core/llm/embedding.tokens';
import { FakeEmbeddingAdapter } from '../../../core/llm/fake.embedding.adapter';
import { DOCUMENT_CHUNKS_REPOSITORY } from '../repositories/document-chunks.repository.port';
import { InMemoryDocumentChunksRepository } from '../repositories/in-memory-document-chunks.repository';
import { DOCUMENTS_REPOSITORY } from '../repositories/documents.repository.port';
import { InMemoryDocumentsRepository } from '../repositories/in-memory-documents.repository';
import { DOCUMENTS_STORAGE } from '../storage/documents-storage.port';
import { InMemoryDocumentsStorage } from '../storage/in-memory-documents.storage';
import { DocumentChunkingService } from '../services/document-chunking.service';
import { DocumentIngestionService } from '../services/document-ingestion.service';
import { DocumentTextExtractorService } from '../services/document-text-extractor.service';
import { DocumentsService } from '../services/documents.service';

/** Shared Nest providers for documents controller integration specs. */
export const documentsControllerTestProviders = [
  DocumentsService,
  DocumentIngestionService,
  DocumentTextExtractorService,
  DocumentChunkingService,
  InMemoryDocumentsStorage,
  InMemoryDocumentsRepository,
  InMemoryDocumentChunksRepository,
  { provide: DOCUMENTS_STORAGE, useExisting: InMemoryDocumentsStorage },
  { provide: DOCUMENTS_REPOSITORY, useExisting: InMemoryDocumentsRepository },
  {
    provide: DOCUMENT_CHUNKS_REPOSITORY,
    useExisting: InMemoryDocumentChunksRepository,
  },
  { provide: EMBEDDING_PORT, useClass: FakeEmbeddingAdapter },
];
