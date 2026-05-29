import { MockLlmAdapter } from './mock.llm.adapter';

describe('MockLlmAdapter', () => {
  const adapter = new MockLlmAdapter();

  it('accepts clear validate-answer responses with turnSummary', async () => {
    const result = await adapter.generateStructured({
      systemPrompt: 'validate',
      userPrompt: `Learner answer:
Je suis étudiant en L2 biologie et je prépare mes partiels.`,
      responseJsonSchema: {},
    });

    expect(result.parsedJson).toEqual({
      valid: true,
      turnSummary: expect.stringContaining('étudiant'),
    });
  });

  it('rejects vague validate-answer with pedagogical rephrasedQuestion', async () => {
    const result = await adapter.generateStructured({
      systemPrompt: 'validate',
      userPrompt: `Learner answer:
euh`,
      responseJsonSchema: {},
    });

    expect(result.parsedJson).toMatchObject({
      valid: false,
      reason: 'too_vague',
    });
    const json = result.parsedJson as Record<string, string>;
    expect(json.rephrasedQuestion).not.toMatch(/préciser/i);
    expect(json.rephrasedQuestion.length).toBeGreaterThan(10);
  });

  it('returns a complete learnerProfile for analyze prompts', async () => {
    const result = await adapter.generateStructured({
      systemPrompt: 'mentions learnerProfile in rules but is validate',
      userPrompt: 'Transcript for analyze',
      responseJsonSchema: {
        required: ['learnerProfile', 'summaryForUser'],
      },
    });

    expect(result.parsedJson).toMatchObject({
      summaryForUser: expect.any(String),
      learnerProfile: {
        primary_role: 'student',
        main_domains: ['sciences'],
        learning_goal: 'exam',
        self_assessed_level: 'intermediate',
        explanation_style: 'step_by_step',
        feedback_tone: 'encouraging',
        tutoring_language: 'fr',
      },
    });
  });
});
