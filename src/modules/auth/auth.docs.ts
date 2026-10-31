import { bearer, jsonBody, ref, responses, successResponse } from '../../docs/common';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from './auth.schema';

const session = (description: string) =>
  successResponse(description, ref('AuthSession'));

export const authDocs = {
  schemas: {
    AuthSession: {
      type: 'object',
      properties: {
        user: ref('User'),
        accessToken: {
          type: 'string',
          description: 'Short-lived JWT. Send as `Authorization: Bearer <token>`.',
        },
      },
    },
  },
  paths: {
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a new account',
        description:
          'Creates a user with the default role and starts a session. The refresh token is set as an httpOnly cookie.',
        requestBody: jsonBody(registerSchema),
        responses: {
          201: session('Account created'),
          400: responses.badRequest,
          409: responses.conflict,
          429: responses.tooManyRequests,
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Log in with email and password',
        requestBody: jsonBody(loginSchema),
        responses: {
          200: session('Logged in'),
          400: responses.badRequest,
          401: responses.unauthorized,
          403: responses.forbidden,
          429: responses.tooManyRequests,
        },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Rotate the refresh token and get a new access token',
        description:
          'Reads the `refreshToken` httpOnly cookie (or `refreshToken` in the body). The old token is revoked; presenting an already-used token revokes the whole session family.',
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: { type: 'object', properties: { refreshToken: { type: 'string' } } },
            },
          },
        },
        responses: { 200: session('Tokens rotated'), 401: responses.unauthorized, 403: responses.forbidden },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Log out of the current session',
        description: 'Revokes the refresh-token family and clears the cookie. Always succeeds.',
        responses: { 200: successResponse('Logged out') },
      },
    },
    '/auth/logout-all': {
      post: {
        tags: ['Auth'],
        summary: 'Log out of every device',
        security: bearer,
        responses: { 200: successResponse('All sessions revoked'), 401: responses.unauthorized },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Get the authenticated user',
        security: bearer,
        responses: { 200: successResponse('Current user', ref('User')), 401: responses.unauthorized },
      },
    },
    '/auth/change-password': {
      post: {
        tags: ['Auth'],
        summary: 'Change the password',
        description: 'Revokes all other sessions and returns fresh tokens for the current one.',
        security: bearer,
        requestBody: jsonBody(changePasswordSchema),
        responses: {
          200: session('Password changed'),
          400: responses.badRequest,
          401: responses.unauthorized,
          429: responses.tooManyRequests,
        },
      },
    },
    '/auth/forgot-password': {
      post: {
        tags: ['Auth'],
        summary: 'Request a password reset link',
        description: 'Always returns 200 so registered emails cannot be discovered.',
        requestBody: jsonBody(forgotPasswordSchema),
        responses: {
          200: successResponse('Request accepted'),
          400: responses.badRequest,
          429: responses.tooManyRequests,
        },
      },
    },
    '/auth/reset-password': {
      post: {
        tags: ['Auth'],
        summary: 'Set a new password using a reset token',
        requestBody: jsonBody(resetPasswordSchema),
        responses: {
          200: successResponse('Password reset'),
          400: responses.badRequest,
          429: responses.tooManyRequests,
        },
      },
    },
  },
};
