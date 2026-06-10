import { Test } from '@nestjs/testing';

import { AppConfigModule, LUCY_CONFIG } from '../../core/config/app-config.module';
import { loadLucyConfig } from '../../core/config/lucy-config';
import { FirebaseAuthGuard } from '../../core/auth/firebase-auth.guard';
import { FirebaseAdminModule } from '../../core/auth/firebase-admin.module';
import { LearningSessionsModule } from './learning-sessions.module';
import { FirestoreLearningSessionsRepository } from './repositories/firestore-learning-sessions.repository';
import { InMemoryLearningSessionsRepository } from './repositories/in-memory-learning-sessions.repository';
import { LEARNING_SESSIONS_REPOSITORY } from './repositories/learning-sessions.repository.port';

describe('LearningSessionsModule (LEARN-01a)', () => {
  async function compileWithConfig(env: Record<string, string>) {
    return Test.createTestingModule({
      imports: [AppConfigModule, FirebaseAdminModule, LearningSessionsModule],
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

  it('uses in-memory repository when FIRESTORE_PROVIDER=memory', async () => {
    const moduleRef = await compileWithConfig({ FIRESTORE_PROVIDER: 'memory' });

    expect(moduleRef.get(LEARNING_SESSIONS_REPOSITORY)).toBeInstanceOf(
      InMemoryLearningSessionsRepository,
    );
  });

  it('uses Firestore repository when FIRESTORE_PROVIDER=firebase', async () => {
    const moduleRef = await compileWithConfig({ FIRESTORE_PROVIDER: 'firebase' });

    expect(moduleRef.get(LEARNING_SESSIONS_REPOSITORY)).toBeInstanceOf(
      FirestoreLearningSessionsRepository,
    );
  });
});
