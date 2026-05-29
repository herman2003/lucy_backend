#!/usr/bin/env node
/**
 * Starts Nest with the documented local stack (no Gemini key, no Firebase Admin).
 * Usage: npm run start:dev:local
 */
import { spawn } from 'node:child_process';

const env = {
  ...process.env,
  NODE_ENV: 'development',
  LLM_PROVIDER: 'mock',
  FIREBASE_AUTH_MODE: 'dev',
  FIRESTORE_PROVIDER: 'memory',
};

const child = spawn('npx', ['nest', 'start', '--watch'], {
  env,
  stdio: 'inherit',
  shell: true,
});

child.on('exit', (code) => process.exit(code ?? 0));
