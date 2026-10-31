import {
  bearer,
  jsonBody,
  paginatedResponse,
  parametersOf,
  ref,
  responses,
  successResponse,
} from '../../docs/common';
import { idParamsSchema } from '../../utils/object-id';
import { EXAMPLE_PRIORITIES, EXAMPLE_STATUSES } from './example.model';
import { createExampleSchema, listExamplesQuerySchema, updateExampleSchema } from './example.schema';

const idParam = parametersOf(idParamsSchema, 'path');

export const exampleDocs = {
  schemas: {
    Example: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '665f1c2e8f1b2a0012a4b3c4' },
        title: { type: 'string' },
        description: { type: 'string' },
        status: { type: 'string', enum: [...EXAMPLE_STATUSES] },
        priority: { type: 'string', enum: [...EXAMPLE_PRIORITIES] },
        tags: { type: 'array', items: { type: 'string' } },
        owner: { type: 'string', description: 'Id of the user who owns the record' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  },
  paths: {
    '/examples': {
      get: {
        tags: ['Examples'],
        summary: 'List examples',
        description:
          'Regular users see their own records; admins and managers see everything. Supports pagination, filtering, sorting (`sort=-createdAt,title`) and search.',
        security: bearer,
        parameters: parametersOf(listExamplesQuerySchema, 'query'),
        responses: { 200: paginatedResponse('Examples', 'Example'), 400: responses.badRequest, 401: responses.unauthorized },
      },
      post: {
        tags: ['Examples'],
        summary: 'Create an example',
        security: bearer,
        requestBody: jsonBody(createExampleSchema),
        responses: {
          201: successResponse('Example created', ref('Example')),
          400: responses.badRequest,
          401: responses.unauthorized,
        },
      },
    },
    '/examples/{id}': {
      get: {
        tags: ['Examples'],
        summary: 'Get an example',
        security: bearer,
        parameters: idParam,
        responses: {
          200: successResponse('Example', ref('Example')),
          400: responses.badRequest,
          401: responses.unauthorized,
          404: responses.notFound,
        },
      },
      patch: {
        tags: ['Examples'],
        summary: 'Update an example',
        security: bearer,
        parameters: idParam,
        requestBody: jsonBody(updateExampleSchema),
        responses: {
          200: successResponse('Example updated', ref('Example')),
          400: responses.badRequest,
          401: responses.unauthorized,
          404: responses.notFound,
        },
      },
      delete: {
        tags: ['Examples'],
        summary: 'Delete an example',
        security: bearer,
        parameters: idParam,
        responses: {
          200: successResponse('Example deleted'),
          400: responses.badRequest,
          401: responses.unauthorized,
          404: responses.notFound,
        },
      },
    },
  },
};
