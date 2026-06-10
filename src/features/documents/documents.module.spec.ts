import { Test } from '@nestjs/testing';

import { FirebaseAuthGuard } from '../../core/auth/firebase-auth.guard';
import { FirebaseAdminModule } from '../../core/auth/firebase-admin.module';
import { AppConfigModule, LUCY_CONFIG } from '../../core/config/app-config.module';
import { loadLucyConfig } from '../../core/config/lucy-config';
import { DocumentsModule } from './documents.module';
import { FirestoreDocumentsRepository } from './repositories/firestore-documents.repository';
import { InMemoryDocumentsRepository } from './repositories/in-memory-documents.repository';
import { DOCUMENTS_REPOSITORY } from './repositories/documents.repository.port';
import { FirebaseDocumentsStorage } from './storage/firebase-documents.storage';
import { InMemoryDocumentsStorage } from './storage/in-memory-documents.storage';
import { R2DocumentsStorage } from './storage/r2-documents.storage';
import { DOCUMENTS_STORAGE } from './storage/documents-storage.port';

describe('DocumentsModule providers', () => {
  async function compileWithConfig(env: Record<string, string>) {
    return Test.createTestingModule({
      imports: [AppConfigModule, FirebaseAdminModule, DocumentsModule],
    })
      .overrideProvider(LUCY_CONFIG)
      .useValue(
        loadLucyConfig({
          NODE_ENV: 'development',
          FIREBASE_AUTH_MODE: 'dev',
          LLM_PROVIDER: 'mock',
          ...env,
        }),
      )
      .overrideGuard(FirebaseAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
  }

  it('uses in-memory repository and storage when FIRESTORE_PROVIDER=memory', async () => {
    const moduleRef = await compileWithConfig({ FIRESTORE_PROVIDER: 'memory' });

    expect(moduleRef.get(DOCUMENTS_REPOSITORY)).toBeInstanceOf(InMemoryDocumentsRepository);
    expect(moduleRef.get(DOCUMENTS_STORAGE)).toBeInstanceOf(InMemoryDocumentsStorage);
  });

  it('uses firebase storage when FIRESTORE_PROVIDER=firebase and STORAGE_PROVIDER unset', async () => {
    const moduleRef = await compileWithConfig({ FIRESTORE_PROVIDER: 'firebase' });

    expect(moduleRef.get(DOCUMENTS_REPOSITORY)).toBeInstanceOf(FirestoreDocumentsRepository);
    expect(moduleRef.get(DOCUMENTS_STORAGE)).toBeInstanceOf(FirebaseDocumentsStorage);
  });

  it('uses R2 storage when STORAGE_PROVIDER=r2', async () => {
    const moduleRef = await compileWithConfig({
      FIRESTORE_PROVIDER: 'firebase',
      STORAGE_PROVIDER: 'r2',
      R2_BUCKET: 'lucy',
      R2_ACCESS_KEY_ID: 'key',
      R2_SECRET_ACCESS_KEY: 'secret',
      R2_ENDPOINT: 'https://acct.r2.cloudflarestorage.com',
    });

    expect(moduleRef.get(DOCUMENTS_REPOSITORY)).toBeInstanceOf(FirestoreDocumentsRepository);
    expect(moduleRef.get(DOCUMENTS_STORAGE)).toBeInstanceOf(R2DocumentsStorage);
  });
});
