import { LucyApiError } from '../../../core/errors/lucy-api.error';
import { LucyErrorCodes } from '../../../core/errors/lucy-error-codes';
import { InMemoryDocumentsRepository } from '../repositories/in-memory-documents.repository';
import { InMemoryDocumentsStorage } from '../storage/in-memory-documents.storage';
import { DocumentsService } from './documents.service';

function createHarness() {
  const storage = new InMemoryDocumentsStorage();
  const chunks = new (class {
    deleteChunks = async () => undefined;
    replaceChunks = async () => undefined;
  })();
  const repo = new InMemoryDocumentsRepository(storage as never, chunks as never);
  const ingestion = { enqueueIngestion: () => undefined };
  const service = new DocumentsService(
    repo as never,
    storage as never,
    chunks as never,
    ingestion as never,
  );
  return { storage, repo, service, chunks };
}

describe('DocumentsService DOC-02', () => {
  const uid = 'u1';

  it('complete is idempotent when already processing/ready', async () => {
    const { repo, service } = createHarness();

    const created = await repo.create(uid, {
      title: 'Doc',
      fileName: 'a.pdf',
      mimeType: 'application/pdf',
      byteSize: 100,
    });
    await repo.updateStatus(uid, created.id, 'processing');

    const result = await service.complete(uid, created.id);
    expect(result.status).toBe('processing');
  });

  it('complete returns DOCUMENT_UPLOAD_NOT_READY when storage object missing', async () => {
    const { repo, service } = createHarness();

    const created = await repo.create(uid, {
      title: 'Doc',
      fileName: 'a.pdf',
      mimeType: 'application/pdf',
      byteSize: 100,
    });

    await expect(service.complete(uid, created.id)).rejects.toMatchObject({
      statusCode: 409,
      error: LucyErrorCodes.DOCUMENT_UPLOAD_NOT_READY,
    } satisfies Partial<LucyApiError>);
  });

  it('complete fails with DOCUMENT_TYPE_MISMATCH when detected mime differs', async () => {
    const { repo, service } = createHarness();

    const created = await repo.create(uid, {
      title: 'Doc',
      fileName: 'a.pdf',
      mimeType: 'application/pdf',
      byteSize: 100,
    });
    repo.__setStorageObjectPresent(uid, created.id, true, 'text/plain');

    await expect(service.complete(uid, created.id)).rejects.toMatchObject({
      statusCode: 422,
      error: LucyErrorCodes.DOCUMENT_TYPE_MISMATCH,
    });

    const detail = await service.getById(uid, created.id);
    expect(detail.status).toBe('failed');
    expect(detail.errorCode).toBe(LucyErrorCodes.DOCUMENT_TYPE_MISMATCH);
  });

  it('delete is forbidden during processing', async () => {
    const { repo, service } = createHarness();

    const created = await repo.create(uid, {
      title: 'Doc',
      fileName: 'a.pdf',
      mimeType: 'application/pdf',
      byteSize: 100,
    });
    await repo.updateStatus(uid, created.id, 'processing');

    await expect(service.delete(uid, created.id)).rejects.toMatchObject({
      statusCode: 409,
      error: LucyErrorCodes.DOCUMENT_PROCESSING_IN_PROGRESS,
    });
  });

  it('patch searchEnabled only allowed when ready and enforces max 5 actives', async () => {
    const { repo, service } = createHarness();

    const ids: string[] = [];
    for (let i = 0; i < 6; i++) {
      const created = await repo.create(uid, {
        title: `Doc ${i}`,
        fileName: 'a.txt',
        mimeType: 'text/plain',
        byteSize: 10,
      });
      await repo.updateStatus(uid, created.id, 'ready');
      ids.push(created.id);
    }

    for (let i = 0; i < 5; i++) {
      const updated = await service.setSearchEnabled(uid, ids[i]!, true);
      expect(updated.searchEnabled).toBe(true);
    }

    await expect(service.setSearchEnabled(uid, ids[5]!, true)).rejects.toMatchObject({
      statusCode: 409,
      error: LucyErrorCodes.SEARCH_ACTIVE_LIMIT_EXCEEDED,
    });
  });

  it('reprocess failed document with storage present enqueues processing', async () => {
    const { repo, service } = createHarness();

    const created = await repo.create(uid, {
      title: 'Doc',
      fileName: 'a.txt',
      mimeType: 'text/plain',
      byteSize: 10,
    });
    repo.__setStorageObjectPresent(uid, created.id, true);
    await repo.markIngestionFailed(uid, created.id, LucyErrorCodes.DOCUMENT_EMPTY_EXTRACTION);

    const result = await service.reprocess(uid, created.id);
    expect(result.status).toBe('processing');

    const doc = await repo.getById(uid, created.id);
    expect(doc?.status).toBe('processing');
    expect(doc?.errorCode).toBeUndefined();
  });
});
