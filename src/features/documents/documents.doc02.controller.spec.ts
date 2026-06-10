import { Test, TestingModule } from '@nestjs/testing';

import { FirebaseAuthGuard } from '../../core/auth/firebase-auth.guard';
import { FirebaseAuthService } from '../../core/auth/firebase-auth.service';
import { LUCY_CONFIG } from '../../core/config/app-config.module';
import { loadLucyConfig } from '../../core/config/lucy-config';
import { LucyErrorCodes } from '../../core/errors/lucy-error-codes';
import { DocumentsController } from './documents.controller';
import { InMemoryDocumentsRepository } from './repositories/in-memory-documents.repository';
import { documentsControllerTestProviders } from './testing/documents-controller-test.providers';

describe('DocumentsController DOC-02 routes', () => {
  let controller: DocumentsController;
  let repo: InMemoryDocumentsRepository;
  const uid = 'dev-user-docs-02';

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [DocumentsController],
      providers: [
        ...documentsControllerTestProviders,
        { provide: FirebaseAuthService, useValue: { verifyIdToken: jest.fn().mockResolvedValue({ uid }) } },
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

  it('POST /documents/:id/complete returns 409 when upload not ready', async () => {
    const created = await controller.createDocument({ user: { uid } } as never, {
      title: 'Doc',
      fileName: 'a.pdf',
      mimeType: 'application/pdf',
      byteSize: 100,
    });

    await expect(
      controller.completeDocument({ user: { uid } } as never, created.id),
    ).rejects.toMatchObject({
      statusCode: 409,
      error: LucyErrorCodes.DOCUMENT_UPLOAD_NOT_READY,
    });
  });

  it('DELETE /documents/:id is forbidden during processing', async () => {
    const created = await controller.createDocument({ user: { uid } } as never, {
      title: 'Doc',
      fileName: 'a.pdf',
      mimeType: 'application/pdf',
      byteSize: 100,
    });
    await repo.updateStatus(uid, created.id, 'processing');

    await expect(
      controller.deleteDocument({ user: { uid } } as never, created.id),
    ).rejects.toMatchObject({
      statusCode: 409,
      error: LucyErrorCodes.DOCUMENT_PROCESSING_IN_PROGRESS,
    });
  });

  it('PATCH /documents/:id enforces max 5 active searchEnabled', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 6; i++) {
      const created = await controller.createDocument({ user: { uid } } as never, {
        title: `Doc ${i}`,
        fileName: 'a.txt',
        mimeType: 'text/plain',
        byteSize: 10,
      });
      await repo.updateStatus(uid, created.id, 'ready');
      ids.push(created.id);
    }

    for (let i = 0; i < 5; i++) {
      const updated = await controller.patchDocument(
        { user: { uid } } as never,
        ids[i]!,
        { searchEnabled: true },
      );
      expect(updated.searchEnabled).toBe(true);
    }

    await expect(
      controller.patchDocument({ user: { uid } } as never, ids[5]!, { searchEnabled: true }),
    ).rejects.toMatchObject({
      statusCode: 409,
      error: LucyErrorCodes.SEARCH_ACTIVE_LIMIT_EXCEEDED,
    });
  });

  it('GET /documents/:id/download returns placeholder url + expiresAt', async () => {
    const created = await controller.createDocument({ user: { uid } } as never, {
      title: 'Doc',
      fileName: 'a.txt',
      mimeType: 'text/plain',
      byteSize: 10,
    });

    const resp = await controller.downloadDocument({ user: { uid } } as never, created.id);
    expect(resp.downloadUrl).toContain('original.txt');
    expect(resp.expiresAt).toEqual(expect.any(String));
  });
});

