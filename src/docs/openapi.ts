import { env } from '../config/env';
import { authDocs } from '../modules/auth/auth.docs';
import { exampleDocs } from '../modules/example/example.docs';
import { filesDocs } from '../modules/files/files.docs';
import { usersDocs } from '../modules/users/users.docs';
import { ref, successResponse } from './common';

/**
 * Add each new module's `*.docs.ts` here (schemas + paths).
 * Paths are relative to API_PREFIX, which is declared as the server URL.
 */
const moduleDocs = [authDocs, usersDocs, exampleDocs, filesDocs];

export const buildOpenApiSpec = () => ({
  openapi: '3.0.3',
  info: {
    title: 'REST API Starter',
    version: '1.0.0',
    description:
      'Production-ready Express 5 + TypeScript + MongoDB starter.\n\n' +
      'Authenticate with `POST /auth/login`, then click **Authorize** and paste the `accessToken`. ' +
      'The refresh token is an httpOnly cookie scoped to `/auth`.',
  },
  servers: [{ url: env.API_PREFIX }],
  tags: [
    { name: 'Health' },
    { name: 'Auth', description: 'Registration, sessions and password management' },
    { name: 'Users', description: 'Profile and user administration' },
    { name: 'Examples', description: 'Example CRUD module to copy from' },
    { name: 'Files', description: 'Image/file upload, listing, download and deletion' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Liveness / readiness check',
        description: 'Returns 503 while the database is not connected.',
        responses: {
          200: successResponse('Service is healthy', {
            type: 'object',
            properties: {
              status: { type: 'string', example: 'ok' },
              uptime: { type: 'number', description: 'Seconds since process start' },
              timestamp: { type: 'string', format: 'date-time' },
              database: { type: 'string', example: 'connected' },
            },
          }),
          503: { description: 'Database unavailable', content: { 'application/json': { schema: ref('ErrorResponse') } } },
        },
      },
    },
    ...Object.assign({}, ...moduleDocs.map((docs) => docs.paths)),
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        required: ['success', 'message', 'errors'],
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: 'Validation failed' },
          errors: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                field: { type: 'string', example: 'body.email' },
                message: { type: 'string', example: 'Invalid email address' },
              },
            },
          },
        },
      },
      PaginationMeta: {
        type: 'object',
        properties: {
          page: { type: 'integer', example: 1 },
          limit: { type: 'integer', example: 20 },
          total: { type: 'integer', example: 42 },
          totalPages: { type: 'integer', example: 3 },
          hasNextPage: { type: 'boolean' },
          hasPrevPage: { type: 'boolean' },
        },
      },
      ...Object.assign({}, ...moduleDocs.map((docs) => docs.schemas)),
    },
  },
});
