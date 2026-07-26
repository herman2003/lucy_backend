import { SchemaType, type ArraySchema, type ObjectSchema } from '@google/generative-ai';

import { FLASHCARDS_GENERATION_JSON_SCHEMA } from '../../features/learning-sessions/dto/learning-session.constants';
import { toGeminiResponseSchema } from './gemini-json-schema';

describe('gemini-json-schema', () => {
  it('converts flashcards JSON schema to Gemini responseSchema', () => {
    const schema = toGeminiResponseSchema(
      FLASHCARDS_GENERATION_JSON_SCHEMA,
    ) as ObjectSchema;

    expect(schema.type).toBe(SchemaType.OBJECT);
    expect(schema.required).toEqual(['items']);

    const items = schema.properties.items as ArraySchema;
    expect(items.type).toBe(SchemaType.ARRAY);

    const card = items.items as ObjectSchema;
    expect(card.type).toBe(SchemaType.OBJECT);
    expect(card.required).toEqual(['front', 'back', 'sourceChunkIds']);
  });
});
