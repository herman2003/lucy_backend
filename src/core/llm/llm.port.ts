export interface LlmStructuredRequest {
  systemPrompt: string;
  userPrompt: string;
  responseJsonSchema: object;
}

export interface LlmStructuredResponse {
  rawText: string;
  parsedJson?: unknown;
}

export interface LlmPort {
  generateStructured(input: LlmStructuredRequest): Promise<LlmStructuredResponse>;
}
