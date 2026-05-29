import { Test, TestingModule } from '@nestjs/testing';

import { FirebaseAuthGuard } from '../../core/auth/firebase-auth.guard';
import { FirebaseAuthService } from '../../core/auth/firebase-auth.service';
import { LUCY_CONFIG } from '../../core/config/app-config.module';
import { loadLucyConfig } from '../../core/config/lucy-config';
import { DocumentsController } from './documents.controller';
import { InMemoryDocumentsRepository } from './repositories/in-memory-documents.repository';
import { documentsControllerTestProviders } from './testing/documents-controller-test.providers';

/** DOC-06 / CP-D1 — vertical slice: create → upload sim → complete → list. */
describe('Documents D1 flow (memory)', () => {
  let controller: DocumentsController;
  let repo: InMemoryDocumentsRepository;
  const uid = 'dev-user-d1-flow';

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [DocumentsController],
      providers: [
        ...documentsControllerTestProviders,
        {
          provide: FirebaseAuthService,
          useValue: { verifyIdToken: jest.fn().mockResolvedValue({ uid }) },
        },
        {
          provide: LUCY_CONFIG,
          useValue: loadLucyConfig({
            NODE_ENV: 'development',
            LLM_PROVIDER: 'mock',
            FIREBASE_AUTH_MODE: 'dev',
            FIRESTORE_PROVIDER: 'memory',
          }),
        },
      ],
    })
      .overrideGuard(FirebaseAuthGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => { getRequest: () => { user?: { uid: string } } };
        }) => {
          const request = context.switchToHttp().getRequest();
          request.user = { uid };
          return true;
        },
      })
      .compile();

    controller = moduleRef.get(DocumentsController);
    repo = moduleRef.get(InMemoryDocumentsRepository);
  });

  it('create → multipart upload → complete → list contains document in processing', async () => {
    const created = await controller.createDocument({ user: { uid } } as never, {
      title: 'Via proxy',
      fileName: 'notes.txt',
      mimeType: 'text/plain',
      byteSize: 42,
    });

    const body = Buffer.alloc(42, 'x');
    await controller.uploadDocumentFile(
      { user: { uid } } as never,
      created.id,
      {
        buffer: body,
        size: body.length,
        mimetype: 'text/plain',
      } as Express.Multer.File,
    );

    const completed = await controller.completeDocument(
      { user: { uid } } as never,
      created.id,
    );
    expect(completed.status).toBe('processing');

    const list = await controller.listDocuments({ user: { uid } } as never);
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe(created.id);
  });

  it('create → complete → list contains document in processing', async () => {
    const created = await controller.createDocument({ user: { uid } } as never, {
      title: 'Grammaire B1',
      fileName: 'notes.txt',
      mimeType: 'text/plain',
      byteSize: 42,
    });

    repo.__setStorageObjectPresent(uid, created.id, true, 'text/plain');

    const completed = await controller.completeDocument(
      { user: { uid } } as never,
      created.id,
    );
    expect(completed.status).toBe('processing');

    const list = await controller.listDocuments({ user: { uid } } as never);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      id: created.id,
      title: 'Grammaire B1',
      status: 'processing',
    });
  });

  it('ready document exposes signed download URL', async () => {
    const created = await controller.createDocument({ user: { uid } } as never, {
      title: 'Cours',
      fileName: 'cours.pdf',
      mimeType: 'application/pdf',
      byteSize: 100,
    });
    repo.__setStorageObjectPresent(uid, created.id, true, 'application/pdf');
    await controller.completeDocument({ user: { uid } } as never, created.id);
    await repo.updateStatus(uid, created.id, 'ready');

    const download = await controller.downloadDocument(
      { user: { uid } } as never,
      created.id,
    );
    expect(download.downloadUrl).toEqual(expect.stringContaining('memory://'));
    expect(download.expiresAt).toEqual(expect.any(String));
  });
});
