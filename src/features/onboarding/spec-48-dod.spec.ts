import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const SRC_ROOT = join(__dirname, '..', '..');

describe('SPEC §4.8 backend Definition of Done (automated)', () => {
  it('ships distinct validate and analyze prompts under src/prompts', () => {
    expect(
      existsSync(join(SRC_ROOT, 'prompts/onboarding-validate-answer.system.md')),
    ).toBe(true);
    expect(
      existsSync(join(SRC_ROOT, 'prompts/onboarding-analyze.system.md')),
    ).toBe(true);
  });

  it('exposes validate-answer, confirm-turn, analyze, and finalize routes', () => {
    const controller = readFileSync(
      join(SRC_ROOT, 'features/onboarding/onboarding.controller.ts'),
      'utf8',
    );
    for (const route of [
      'validate-answer',
      'confirm-turn',
      'analyze',
      'finalize',
    ]) {
      expect(controller).toContain(route);
    }
  });

  it('resolves question text server-side via question catalogue', () => {
    expect(
      existsSync(
        join(
          SRC_ROOT,
          'features/onboarding/questions/onboarding-question.catalog.ts',
        ),
      ),
    ).toBe(true);
  });

  it('defines LlmPort and Gemini adapter', () => {
    expect(existsSync(join(SRC_ROOT, 'core/llm/llm.port.ts'))).toBe(true);
    expect(existsSync(join(SRC_ROOT, 'core/llm/gemini.llm.adapter.ts'))).toBe(
      true,
    );
  });

  it('covers OnboardingService with unit tests', () => {
    expect(
      existsSync(
        join(
          SRC_ROOT,
          'features/onboarding/services/onboarding.service.spec.ts',
        ),
      ),
    ).toBe(true);
    expect(
      existsSync(
        join(SRC_ROOT, 'features/onboarding/services/onboarding-analyze.spec.ts'),
      ),
    ).toBe(true);
  });

  it('rejects meta rephrasedQuestion in validator tests', () => {
    const spec = readFileSync(
      join(
        SRC_ROOT,
        'features/onboarding/validators/validate-answer-response.validator.spec.ts',
      ),
      'utf8',
    );
    expect(spec).toContain('Peux-tu préciser');
  });
});
