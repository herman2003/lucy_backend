import type { LucyConfig } from './lucy-config';

export type DevStackStatus = {
  llmProvider: string;
  firebaseAuthMode: string;
  firestoreProvider: string;
  storageProvider: string;
  geminiConfigured: boolean;
  openRouterConfigured: boolean;
  localStackReady: boolean;
};

export function isLocalDevStackReady(config: LucyConfig): boolean {
  return (
    config.nodeEnv !== 'production' &&
    config.llmProvider === 'mock' &&
    config.firebaseAuthMode === 'dev' &&
    config.firestoreProvider === 'memory'
  );
}

export function describeDevStack(config: LucyConfig): DevStackStatus {
  return {
    llmProvider: config.llmProvider,
    firebaseAuthMode: config.firebaseAuthMode,
    firestoreProvider: config.firestoreProvider,
    storageProvider: config.storageProvider,
    geminiConfigured: config.geminiApiKey.trim().length > 0,
    openRouterConfigured: config.openRouterApiKey.trim().length > 0,
    localStackReady: isLocalDevStackReady(config),
  };
}
