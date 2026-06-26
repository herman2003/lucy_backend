import { Test, TestingModule } from '@nestjs/testing';

import { LUCY_CONFIG } from '../src/core/config/app-config.module';
import { loadLucyConfig } from '../src/core/config/lucy-config';
import { HealthController } from '../src/health/health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
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
    }).compile();

    controller = module.get(HealthController);
  });

  it('returns ok status with dev stack details in non-production', () => {
    expect(controller.check()).toEqual({
      status: 'ok',
      service: 'lucy-backend',
      dev: {
        llmProvider: 'mock',
        firebaseAuthMode: 'dev',
        firestoreProvider: 'memory',
        geminiConfigured: false,
        openRouterConfigured: false,
        localStackReady: true,
        storageProvider: 'firebase',
      },
    });
  });
});
