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
import { USER_ROLES, USER_STATUSES } from './users.constants';
import {
  createUserSchema,
  listUsersQuerySchema,
  updateProfileSchema,
  updateUserSchema,
} from './users.schema';

const idParam = parametersOf(idParamsSchema, 'path');

export const usersDocs = {
  schemas: {
    User: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '665f1c2e8f1b2a0012a4b3c4' },
        name: { type: 'string' },
        email: { type: 'string', format: 'email' },
        role: { type: 'string', enum: [...USER_ROLES] },
        status: { type: 'string', enum: [...USER_STATUSES] },
        lastLoginAt: { type: 'string', format: 'date-time' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  },
  paths: {
    '/users/me': {
      get: {
        tags: ['Users'],
        summary: 'Get my profile',
        security: bearer,
        responses: { 200: successResponse('Profile', ref('User')), 401: responses.unauthorized },
      },
      patch: {
        tags: ['Users'],
        summary: 'Update my profile',
        security: bearer,
        requestBody: jsonBody(updateProfileSchema),
        responses: {
          200: successResponse('Profile updated', ref('User')),
          400: responses.badRequest,
          401: responses.unauthorized,
        },
      },
    },
    '/users': {
      get: {
        tags: ['Users'],
        summary: 'List users (admin, manager)',
        security: bearer,
        parameters: parametersOf(listUsersQuerySchema, 'query'),
        responses: {
          200: paginatedResponse('Users', 'User'),
          401: responses.unauthorized,
          403: responses.forbidden,
        },
      },
      post: {
        tags: ['Users'],
        summary: 'Create a user with any role (admin)',
        security: bearer,
        requestBody: jsonBody(createUserSchema),
        responses: {
          201: successResponse('User created', ref('User')),
          400: responses.badRequest,
          401: responses.unauthorized,
          403: responses.forbidden,
          409: responses.conflict,
        },
      },
    },
    '/users/{id}': {
      get: {
        tags: ['Users'],
        summary: 'Get a user by id (admin, manager)',
        security: bearer,
        parameters: idParam,
        responses: {
          200: successResponse('User', ref('User')),
          401: responses.unauthorized,
          403: responses.forbidden,
          404: responses.notFound,
        },
      },
      patch: {
        tags: ['Users'],
        summary: 'Update name, role or status (admin)',
        security: bearer,
        parameters: idParam,
        requestBody: jsonBody(updateUserSchema),
        responses: {
          200: successResponse('User updated', ref('User')),
          400: responses.badRequest,
          401: responses.unauthorized,
          403: responses.forbidden,
          404: responses.notFound,
        },
      },
      delete: {
        tags: ['Users'],
        summary: 'Delete a user (admin)',
        security: bearer,
        parameters: idParam,
        responses: {
          200: successResponse('User deleted'),
          401: responses.unauthorized,
          403: responses.forbidden,
          404: responses.notFound,
        },
      },
    },
  },
};
