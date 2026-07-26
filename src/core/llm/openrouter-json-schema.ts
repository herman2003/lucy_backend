/** Prepares a JSON Schema for OpenRouter `response_format.json_schema` (strict mode). */
export function toOpenRouterJsonSchema(schema: object): Record<string, unknown> {
  return withStrictObjectSchema(schema as Record<string, unknown>);
}

function withStrictObjectSchema(
  node: Record<string, unknown>,
): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...node };

  if (copy.type === 'object') {
    copy.additionalProperties = false;
  }

  if (copy.properties && typeof copy.properties === 'object') {
    const properties: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(
      copy.properties as Record<string, unknown>,
    )) {
      properties[key] = normalizeSchemaNode(value);
    }
    copy.properties = properties;
  }

  if (copy.items !== undefined) {
    copy.items = normalizeSchemaNode(copy.items);
  }

  return copy;
}

function normalizeSchemaNode(node: unknown): unknown {
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    return node;
  }
  return withStrictObjectSchema(node as Record<string, unknown>);
}

/** Strips optional Markdown fences around JSON LLM output. */
export function extractJsonText(raw: string): string {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenceMatch) {
    return fenceMatch[1]!.trim();
  }
  return trimmed;
}
