import { extractJsonText, toOpenRouterJsonSchema } from './openrouter-json-schema';

describe('openrouter-json-schema', () => {
  it('adds additionalProperties false for strict OpenRouter schemas', () => {
    const schema = toOpenRouterJsonSchema({
      type: 'object',
      required: ['items'],
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              question: { type: 'string' },
            },
          },
        },
      },
    });

    expect(schema.additionalProperties).toBe(false);
    const items = (schema.properties as Record<string, unknown>).items as Record<
      string,
      unknown
    >;
    const item = items.items as Record<string, unknown>;
    expect(item.additionalProperties).toBe(false);
  });

  it('extracts JSON from markdown fences', () => {
    expect(extractJsonText('```json\n{"items":[]}\n```')).toBe('{"items":[]}');
  });
});
