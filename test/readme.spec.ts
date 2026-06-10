import { readFileSync } from 'fs';
import { join } from 'path';

const README_PATH = join(__dirname, '..', 'README.md');

const ONBOARDING_ENDPOINTS = [
  'validate-answer',
  'confirm-turn',
  'analyze',
  'finalize',
] as const;

describe('README.md', () => {
  const readme = readFileSync(README_PATH, 'utf8');

  it.each(ONBOARDING_ENDPOINTS)('documents onboarding endpoint %s', (segment) => {
    expect(readme).toContain(segment);
    expect(readme).toContain(`/v1/onboarding/${segment}`);
  });

  it('documents environment setup', () => {
    expect(readme).toContain('GEMINI_API_KEY');
    expect(readme).toContain('.env.example');
  });

  it('documents npm scripts for dev and tests', () => {
    expect(readme).toContain('npm run start:dev');
    expect(readme).toContain('npm test');
  });
});
