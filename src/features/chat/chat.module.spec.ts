import { Test } from '@nestjs/testing';

import { FirebaseAuthGuard } from '../../core/auth/firebase-auth.guard';
import { FirebaseAdminModule } from '../../core/auth/firebase-admin.module';
import { AppConfigModule, LUCY_CONFIG } from '../../core/config/app-config.module';
import { loadLucyConfig } from '../../core/config/lucy-config';
import { ChatModule } from './chat.module';
import { FirestoreChatsRepository } from './repositories/firestore-chats.repository';
import { InMemoryChatsRepository } from './repositories/in-memory-chats.repository';
import { CHATS_REPOSITORY } from './repositories/chats.repository.port';

describe('ChatModule providers (CHAT-03)', () => {
  async function compileWithConfig(env: Record<string, string>) {
    return Test.createTestingModule({
      imports: [AppConfigModule, FirebaseAdminModule, ChatModule],
    })
      .overrideProvider(LUCY_CONFIG)
      .useValue(
        loadLucyConfig({
          NODE_ENV: 'development',
          FIREBASE_AUTH_MODE: 'dev',
          LLM_PROVIDER: 'mock',
          FIRESTORE_PROVIDER: 'memory',
          ...env,
        }),
      )
      .overrideGuard(FirebaseAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
  }

  it('uses in-memory chats repository when FIRESTORE_PROVIDER=memory', async () => {
    const moduleRef = await compileWithConfig({ FIRESTORE_PROVIDER: 'memory' });

    expect(moduleRef.get(CHATS_REPOSITORY)).toBeInstanceOf(InMemoryChatsRepository);
  });

  it('uses Firestore chats repository when FIRESTORE_PROVIDER=firebase', async () => {
    const moduleRef = await compileWithConfig({ FIRESTORE_PROVIDER: 'firebase' });

    expect(moduleRef.get(CHATS_REPOSITORY)).toBeInstanceOf(FirestoreChatsRepository);
  });
});
