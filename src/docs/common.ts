import { z, type ZodType } from 'zod';

/* Small helpers that keep the OpenAPI docs in sync with the Zod request schemas. */

type JsonObject = Record<string, unknown>;

export const schemaOf = (schema: ZodType): JsonObject => {
  const json = z.toJSONSchema(schema, {
    target: 'openapi-3.0',
    io: 'input',
    unrepresentable: 'any',
  }) as JsonObject;
  delete json.$schema;
  return json;
};

export const jsonBody = (schema: ZodType, description?: string) => ({
  required: true,
  ...(description ? { description } : {}),
  content: { 'application/json': { schema: schemaOf(schema) } },
});

/** Turns a Zod object schema (query or path params) into OpenAPI parameter objects. */
export const parametersOf = (schema: ZodType, location: 'query' | 'path') => {
  const json = schemaOf(schema) as { properties?: Record<string, JsonObject>; required?: string[] };
  return Object.entries(json.properties ?? {}).map(([name, propertySchema]) => ({
    name,
    in: location,
    required: location === 'path' || (json.required ?? []).includes(name),
    schema: propertySchema,
  }));
};

export const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });

export const errorResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: ref('ErrorResponse') } },
});

export const responses = {
  badRequest: errorResponse('Validation failed or malformed request'),
  unauthorized: errorResponse('Missing, invalid or expired credentials'),
  forbidden: errorResponse('Authenticated but not allowed'),
  notFound: errorResponse('Resource not found'),
  conflict: errorResponse('Resource already exists'),
  tooManyRequests: errorResponse('Rate limit exceeded'),
};

/** `{ success, message, data }` envelope with a custom `data` schema. */
export const successResponse = (description: string, data: JsonObject | null = null) => ({
  description,
  content: {
    'application/json': {
      schema: {
        type: 'object',
        required: ['success', 'message', 'data'],
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Operation successful' },
          data: data ?? { nullable: true, example: null },
        },
      },
    },
  },
});

export const paginatedResponse = (description: string, itemSchemaName: string) => ({
  description,
  content: {
    'application/json': {
      schema: {
        type: 'object',
        required: ['success', 'message', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Operation successful' },
          data: { type: 'array', items: ref(itemSchemaName) },
          meta: {
            type: 'object',
            properties: { pagination: ref('PaginationMeta') },
          },
        },
      },
    },
  },
});

export const bearer = [{ bearerAuth: [] }];
