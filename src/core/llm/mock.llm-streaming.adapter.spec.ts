import { MockLlmStreamingAdapter, collectStreamText, MOCK_STREAM_FULL_TEXT } from './mock.llm-streaming.adapter';

describe('MockLlmStreamingAdapter', () => {
  const adapter = new MockLlmStreamingAdapter();

  it('emits 4 fixed deltas that concatenate to the mock reply', async () => {
    const deltas: string[] = [];
    for await (const delta of adapter.streamText({
      systemPrompt: 'sys',
      userPrompt: 'user',
    })) {
      deltas.push(delta);
    }

    expect(deltas).toHaveLength(4);
    expect(deltas.join('')).toBe(MOCK_STREAM_FULL_TEXT);
  });

  it('collectStreamText matches full mock text', async () => {
    const text = await collectStreamText(
      adapter.streamText({ systemPrompt: 'sys', userPrompt: 'user' }),
    );
    expect(text).toBe('Lucy mock stream reply.');
  });
});
