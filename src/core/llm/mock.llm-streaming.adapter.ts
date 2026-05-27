import { Injectable } from '@nestjs/common';

import type { LlmStreamingPort, LlmStreamingRequest } from './llm-streaming.port';

/** Fixed deltas for tests and local dev when `LLM_PROVIDER=mock`. */
export const MOCK_STREAM_DELTAS = ['Lucy ', 'mock ', 'stream ', 'reply.'] as const;

export const MOCK_STREAM_FULL_TEXT = MOCK_STREAM_DELTAS.join('');

@Injectable()
export class MockLlmStreamingAdapter implements LlmStreamingPort {
  streamText(_input: LlmStreamingRequest): AsyncIterable<string> {
    return mockStreamFromDeltas([...MOCK_STREAM_DELTAS]);
  }
}

export async function collectStreamText(stream: AsyncIterable<string>): Promise<string> {
  let text = '';
  for await (const delta of stream) {
    text += delta;
  }
  return text;
}

export function mockStreamFromDeltas(deltas: string[]): AsyncIterable<string> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const delta of deltas) {
        yield delta;
      }
    },
  };
}
