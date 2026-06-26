import { GEMINI_EMBEDDING_MODEL_DEFAULT } from '../llm/embedding.constants';
import {
  OPENROUTER_APP_NAME_DEFAULT,
  OPENROUTER_APP_URL_DEFAULT,
  OPENROUTER_MODEL_DEFAULT,
} from '../llm/openrouter.constants';
import { parseCorsAllowedOrigins } from './lucy-cors';

export type LlmProvider = 'gemini' | 'openrouter' | 'mock';
export type FirebaseAuthMode = 'firebase' | 'dev';
export type FirestoreProvider = 'firebase' | 'memory';
export type StorageProvider = 'firebase' | 'r2';

export type LucyConfig = {
  port: number;
  nodeEnv: string;
  firebaseProjectId: string;
  firebaseStorageBucket: string;
  storageProvider: StorageProvider;
  r2AccountId: string;
  r2AccessKeyId: string;
  r2SecretAccessKey: string;
  r2Bucket: string;
  r2Endpoint: string;
  llmProvider: LlmProvider;
  geminiApiKey: string;
  geminiModel: string;
  geminiEmbeddingModel: string;
  openRouterApiKey: string;
  openRouterModel: string;
  openRouterAppUrl: string;
  openRouterAppName: string;
  corsAllowedOrigins: string[];
  firebaseAuthMode: FirebaseAuthMode;
  firestoreProvider: FirestoreProvider;
};

export function loadLucyConfig(
  env: NodeJS.ProcessEnv = process.env,
): LucyConfig {
  const llmProvider = (env.LLM_PROVIDER ?? 'gemini') as LlmProvider;

  const firebaseProjectId = env.FIREBASE_PROJECT_ID ?? 'lucy-7504c';
  const r2AccountId = env.R2_ACCOUNT_ID ?? '';
  const r2Endpoint =
    env.R2_ENDPOINT?.trim() ||
    (r2AccountId
      ? `https://${r2AccountId}.r2.cloudflarestorage.com`
      : '');

  return {
    port: Number(env.PORT ?? 3001),
    nodeEnv: env.NODE_ENV ?? 'development',
    firebaseProjectId,
    firebaseStorageBucket:
      env.FIREBASE_STORAGE_BUCKET ?? `${firebaseProjectId}.appspot.com`,
    storageProvider: resolveStorageProvider(env),
    r2AccountId,
    r2AccessKeyId: env.R2_ACCESS_KEY_ID ?? '',
    r2SecretAccessKey: env.R2_SECRET_ACCESS_KEY ?? '',
    r2Bucket: env.R2_BUCKET ?? '',
    r2Endpoint,
    llmProvider,
    geminiApiKey: env.GEMINI_API_KEY ?? '',
    geminiModel: env.GEMINI_MODEL ?? 'gemini-2.5-flash',
    geminiEmbeddingModel:
      env.GEMINI_EMBEDDING_MODEL ?? GEMINI_EMBEDDING_MODEL_DEFAULT,
    openRouterApiKey: env.OPENROUTER_API_KEY ?? '',
    openRouterModel: env.OPENROUTER_MODEL ?? OPENROUTER_MODEL_DEFAULT,
    openRouterAppUrl: env.OPENROUTER_APP_URL ?? OPENROUTER_APP_URL_DEFAULT,
    openRouterAppName: env.OPENROUTER_APP_NAME ?? OPENROUTER_APP_NAME_DEFAULT,
    corsAllowedOrigins: parseCorsAllowedOrigins(env.CORS_ALLOWED_ORIGINS),
    firebaseAuthMode: resolveFirebaseAuthMode(env),
    firestoreProvider: resolveFirestoreProvider(env),
  };
}

/** Fail fast when R2 is selected but credentials or bucket are missing. */
export function validateLucyConfig(config: LucyConfig): void {
  if (config.llmProvider === 'openrouter' && !config.openRouterApiKey.trim()) {
    throw new Error(
      'LLM_PROVIDER=openrouter requires OPENROUTER_API_KEY. See backend/.env.example',
    );
  }

  if (config.firestoreProvider === 'memory') {
    return;
  }
  if (config.storageProvider !== 'r2') {
    return;
  }

  const missing: string[] = [];
  if (!config.r2Bucket.trim()) {
    missing.push('R2_BUCKET');
  }
  if (!config.r2AccessKeyId.trim()) {
    missing.push('R2_ACCESS_KEY_ID');
  }
  if (!config.r2SecretAccessKey.trim()) {
    missing.push('R2_SECRET_ACCESS_KEY');
  }
  if (!config.r2Endpoint.trim()) {
    missing.push('R2_ENDPOINT or R2_ACCOUNT_ID');
  }

  if (missing.length > 0) {
    throw new Error(
      `STORAGE_PROVIDER=r2 requires: ${missing.join(', ')}. See backend/.env.example`,
    );
  }
}

function resolveStorageProvider(env: NodeJS.ProcessEnv): StorageProvider {
  const raw = env.STORAGE_PROVIDER?.trim().toLowerCase();
  if (raw === 'r2') {
    return 'r2';
  }
  return 'firebase';
}

function resolveFirebaseAuthMode(env: NodeJS.ProcessEnv): FirebaseAuthMode {
  const nodeEnv = env.NODE_ENV ?? 'development';
  if (nodeEnv === 'production') {
    return 'firebase';
  }
  return env.FIREBASE_AUTH_MODE === 'dev' ? 'dev' : 'firebase';
}

function resolveFirestoreProvider(env: NodeJS.ProcessEnv): FirestoreProvider {
  const nodeEnv = env.NODE_ENV ?? 'development';
  if (nodeEnv === 'production') {
    return 'firebase';
  }
  return env.FIRESTORE_PROVIDER === 'memory' ? 'memory' : 'firebase';
}
