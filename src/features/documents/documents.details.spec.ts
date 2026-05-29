import { Test, TestingModule } from '@nestjs/testing';

import { FirebaseAuthGuard } from '../../core/auth/firebase-auth.guard';
import { FirebaseAuthService } from '../../core/auth/firebase-auth.service';
import { LUCY_CONFIG } from '../../core/config/app-config.module';
import { loadLucyConfig } from '../../core/config/lucy-config';
import { DocumentsController } from './documents.controller';
import { InMemoryDocumentsRepository } from './repositories/in-memory-documents.repository';
import { documentsControllerTestProviders } from './testing/documents-controller-test.providers';

describe('DocumentsController GET /documents/:id (detail)', () => {
  let controller: DocumentsController;
  let moduleRef: TestingModule;
  const uid = 'dev-user-docs-detail';

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
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
  });

  it('returns detail including searchEnabled', async () => {
    const created = await controller.createDocument({ user: { uid } } as never, {
      title: 'Doc',
      fileName: 'a.txt',
      mimeType: 'text/plain',
      byteSize: 100,
    });

    const repo = moduleRef.get(InMemoryDocumentsRepository);
    await repo.updateStatus(uid, created.id, 'ready');

    const detail = await controller.getDocument({ user: { uid } } as never, created.id);
    expect(detail.id).toBe(created.id);
    expect(detail.searchEnabled).toBe(false);
  });
});

