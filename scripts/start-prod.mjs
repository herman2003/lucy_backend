/**
 * Production entrypoint for Render / containers.
 * Writes Firebase Admin credentials from env (never commit the JSON file),
 * then starts the NestJS API.
 */
import { writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';

const json = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON?.trim();
if (json) {
  const path = '/tmp/firebase-service-account.json';
  writeFileSync(path, json, 'utf8');
  process.env.GOOGLE_APPLICATION_CREDENTIALS = path;
}

const child = spawn(process.execPath, ['dist/main.js'], {
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
