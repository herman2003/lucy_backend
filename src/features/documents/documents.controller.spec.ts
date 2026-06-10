import { Test, TestingModule } from '@nestjs/testing';

import { FirebaseAuthGuard } from '../../core/auth/firebase-auth.guard';
import { FirebaseAuthService } from '../../core/auth/firebase-auth.service';
import { LUCY_CONFIG } from '../../core/config/app-config.module';
import { loadLucyConfig } from '../../core/config/lucy-config';
import { DocumentsController } from './documents.controller';
import { InMemoryDocumentsRepository } from './repositories/in-memory-documents.repository';
import { documentsControllerTestProviders } from './testing/documents-controller-test.providers';

describe('DocumentsController', () => {
  let controller: DocumentsController;
  let moduleRef: TestingModule;
  const uid = 'dev-user-docs-1';

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      controllers: [DocumentsController],
      providers: [
        ...documentsControllerTestProviders,
        {
          provide: FirebaseAuthService,
          useValue: {
            verifyIdToken: jest.fn().mockResolvedValue({ uid }),
          },
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
  });

  it('POST /documents creates uploading doc and returns uploadUrl placeholder', async () => {
    const created = await controller.createDocument({ user: { uid } } as never, {
      title: 'Grammaire B1',
      fileName: 'a.txt',
      mimeType: 'text/plain',
      byteSize: 100,
    });

    expect(created.id).toEqual(expect.any(String));
    expect(created.uploadUrl).toEqual(expect.any(String));
    expect(created.expiresAt).toEqual(expect.any(String));
  });

  it('GET /documents returns list sorted by createdAt desc (scoped to uid)', async () => {
    const first = await controller.createDocument({ user: { uid } } as never, {
      title: 'Doc 1',
      fileName: 'a.txt',
      mimeType: 'text/plain',
      byteSize: 100,
    });

    const repo = moduleRef.get(InMemoryDocumentsRepository);
    await repo.updateStatus(uid, first.id, 'ready');

    await new Promise((r) => setTimeout(r, 2));

    await controller.createDocument({ user: { uid } } as never, {
      title: 'Doc 2',
      fileName: 'b.txt',
      mimeType: 'text/plain',
      byteSize: 200,
    });

    const list = await controller.listDocuments({ user: { uid } } as never);

    expect(list).toHaveLength(2);
    expect(list[0]?.title).toBe('Doc 2');
    expect(list[1]?.title).toBe('Doc 1');
  });

  it('POST /documents rejects forbidden mime types', async () => {
    await expect(
      controller.createDocument({ user: { uid } } as never, {
        title: 'Bad',
        fileName: 'a.exe',
        mimeType: 'application/octet-stream',
        byteSize: 100,
      }),
    ).rejects.toMatchObject({
      statusCode: 422,
      error: 'DOCUMENT_TYPE_NOT_ALLOWED',
    });
  });

  it('POST /documents rejects byteSize > 20MB', async () => {
    await expect(
      controller.createDocument({ user: { uid } } as never, {
        title: 'Too big',
        fileName: 'a.pdf',
        mimeType: 'application/pdf',
        byteSize: 20 * 1024 * 1024 + 1,
      }),
    ).rejects.toMatchObject({
      statusCode: 422,
      error: 'DOCUMENT_TOO_LARGE',
    });
  });
});

