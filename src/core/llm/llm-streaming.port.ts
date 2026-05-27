export interface LlmStreamingRequest {
  systemPrompt: string;
  userPrompt: string;
}

export interface LlmStreamingPort {
  streamText(input: LlmStreamingRequest): AsyncIterable<string>;
}
