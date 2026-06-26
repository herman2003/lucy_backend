import {
  SchemaType,
  type ArraySchema,
  type ObjectSchema,
  type ResponseSchema,
} from '@google/generative-ai';

/** Maps Lucy JSON Schema objects to Gemini `GenerationConfig.responseSchema`. */
export function toGeminiResponseSchema(schema: object): ResponseSchema {
  return convertNode(schema as Record<string, unknown>);
}

function convertNode(node: Record<string, unknown>): ResponseSchema {
  const type = readType(node.type);

  switch (type) {
    case SchemaType.STRING:
      return { type: SchemaType.STRING };
    case SchemaType.NUMBER:
      return { type: SchemaType.NUMBER };
    case SchemaType.INTEGER:
      return { type: SchemaType.INTEGER };
    case SchemaType.BOOLEAN:
      return { type: SchemaType.BOOLEAN };
    case SchemaType.ARRAY:
      return convertArray(node);
    case SchemaType.OBJECT:
      return convertObject(node);
    default:
      return { type: SchemaType.OBJECT, properties: {} };
  }
}

function convertArray(node: Record<string, unknown>): ArraySchema {
  const items = node.items;
  const schema: ArraySchema = {
    type: SchemaType.ARRAY,
    items:
      items && typeof items === 'object' && !Array.isArray(items)
        ? convertNode(items as Record<string, unknown>)
        : { type: SchemaType.STRING },
  };

  if (typeof node.minItems === 'number') {
    schema.minItems = node.minItems;
  }
  if (typeof node.maxItems === 'number') {
    schema.maxItems = node.maxItems;
  }

  return schema;
}

function convertObject(node: Record<string, unknown>): ObjectSchema {
  const properties: Record<string, ResponseSchema> = {};

  if (node.properties && typeof node.properties === 'object') {
    for (const [key, value] of Object.entries(
      node.properties as Record<string, unknown>,
    )) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        properties[key] = convertNode(value as Record<string, unknown>);
      }
    }
  }

  const schema: ObjectSchema = {
    type: SchemaType.OBJECT,
    properties,
  };

  if (Array.isArray(node.required)) {
    schema.required = node.required.filter((key): key is string => typeof key === 'string');
  }

  return schema;
}

function readType(value: unknown): SchemaType | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  switch (value) {
    case 'string':
      return SchemaType.STRING;
    case 'number':
      return SchemaType.NUMBER;
    case 'integer':
      return SchemaType.INTEGER;
    case 'boolean':
      return SchemaType.BOOLEAN;
    case 'array':
      return SchemaType.ARRAY;
    case 'object':
      return SchemaType.OBJECT;
    default:
      return undefined;
  }
}
