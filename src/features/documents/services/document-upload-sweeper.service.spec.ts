import { LucyErrorCodes } from '../../../core/errors/lucy-error-codes';
import { InMemoryDocumentChunksRepository } from '../repositories/in-memory-document-chunks.repository';
import { InMemoryDocumentsRepository } from '../repositories/in-memory-documents.repository';
import { InMemoryDocumentsStorage } from '../storage/in-memory-documents.storage';
import { UPLOAD_ABANDONED_AFTER_MS } from '../utils/documents-upload.constants';
import { DocumentUploadSweeperService } from './document-upload-sweeper.service';

describe('DocumentUploadSweeperService', () => {
  it('marks uploading documents older than 24h as UPLOAD_ABANDONED and deletes storage', async () => {
    const storage = new InMemoryDocumentsStorage();
    const chunks = new InMemoryDocumentChunksRepository();
    const repository = new InMemoryDocumentsRepository(storage as never, chunks as never);
    const sweeper = new DocumentUploadSweeperService(repository as never, storage as never);

    const created = await repository.create('u1', {
      title: 'Stale',
      fileName: 'a.txt',
      mimeType: 'text/plain',
      byteSize: 10,
    });
    repository.__setStorageObjectPresent('u1', created.id, true);

    const staleDate = new Date(Date.now() - UPLOAD_ABANDONED_AFTER_MS - 1000).toISOString();
    repository.__backdateTimestamps('u1', created.id, staleDate);

    const swept = await sweeper.sweepAbandonedUploads();

    expect(swept).toBe(1);
    const listed = await repository.list('u1');
    expect(listed[0]?.status).toBe('failed');
    expect(listed[0]?.errorCode).toBe(LucyErrorCodes.UPLOAD_ABANDONED);
    expect(await storage.isObjectPresent(created.storagePath, created.byteSize)).toBe(false);
  });

  it('ignores recent uploading documents', async () => {
    const storage = new InMemoryDocumentsStorage();
    const chunks = new InMemoryDocumentChunksRepository();
    const repository = new InMemoryDocumentsRepository(storage as never, chunks as never);
    const sweeper = new DocumentUploadSweeperService(repository as never, storage as never);

    await repository.create('u1', {
      title: 'Fresh',
      fileName: 'a.txt',
      mimeType: 'text/plain',
      byteSize: 10,
    });

    const swept = await sweeper.sweepAbandonedUploads();
    expect(swept).toBe(0);
  });

  it('returns 0 when Firestore collection-group index is missing', async () => {
    const repository = {
      listByStatus: jest.fn().mockRejectedValue({ code: 9, details: 'index required' }),
    };
    const sweeper = new DocumentUploadSweeperService(
      repository as never,
      {} as never,
    );

    await expect(sweeper.sweepAbandonedUploads()).resolves.toBe(0);
  });

  it('returns 0 when Firestore is temporarily unreachable', async () => {
    const repository = {
      listByStatus: jest.fn().mockRejectedValue({
        code: 14,
        message: 'Name resolution failed for target dns:firestore.googleapis.com:443',
      }),
    };
    const sweeper = new DocumentUploadSweeperService(
      repository as never,
      {} as never,
    );

    await expect(sweeper.sweepAbandonedUploads()).resolves.toBe(0);
  });
});
