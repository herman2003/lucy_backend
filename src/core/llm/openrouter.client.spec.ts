import { OpenRouterClient } from './openrouter.client';

describe('OpenRouterClient', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns structured completion content', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: '{"items":[]}' } }],
      }),
    });

    const client = new OpenRouterClient({
      apiKey: 'sk-or-test',
      model: 'google/gemini-2.5-flash',
      appUrl: 'http://localhost:3001',
      appName: 'Lucy API',
    });

    const content = await client.createStructuredCompletion({
      systemPrompt: 'sys',
      userPrompt: 'user',
      responseJsonSchema: { type: 'object' },
    });

    expect(content).toBe('{"items":[]}');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(init.body as string) as {
      response_format?: {
        type: string;
        json_schema?: { strict?: boolean; schema?: { additionalProperties?: boolean } };
      };
    };
    expect(body.response_format?.type).toBe('json_schema');
    expect(body.response_format?.json_schema?.strict).toBe(true);
    expect(body.response_format?.json_schema?.schema?.additionalProperties).toBe(
      false,
    );
  });

  it('streams text deltas from SSE payloads', async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
          ),
        );
        controller.enqueue(
          encoder.encode(
            'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
          ),
        );
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body,
    });

    const client = new OpenRouterClient({
      apiKey: 'sk-or-test',
      model: 'google/gemini-2.5-flash',
      appUrl: 'http://localhost:3001',
      appName: 'Lucy API',
    });

    const deltas: string[] = [];
    for await (const delta of client.streamText({
      systemPrompt: 'sys',
      userPrompt: 'user',
    })) {
      deltas.push(delta);
    }

    expect(deltas).toEqual(['Hello', ' world']);
  });
});
