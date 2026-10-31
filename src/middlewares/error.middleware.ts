import type { ErrorRequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { Error as MongooseError } from 'mongoose';
import { ZodError } from 'zod';
import { env } from '../config/env';
import { sendError } from '../utils/api-response';
import { AppError, type ErrorDetail } from '../utils/app-error';
import { logger } from '../utils/logger';

interface NormalizedError {
  statusCode: number;
  message: string;
  errors: ErrorDetail[];
}

interface HttpLikeError extends Error {
  status?: number;
  statusCode?: number;
  type?: string;
  expose?: boolean;
}

interface MongoDuplicateKeyError extends Error {
  code: number;
  keyValue?: Record<string, unknown>;
}

const isMongoDuplicateKey = (error: unknown): error is MongoDuplicateKeyError =>
  typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 11000;

const normalizeError = (error: unknown): NormalizedError => {
  if (error instanceof AppError) {
    return { statusCode: error.statusCode, message: error.message, errors: error.errors };
  }

  if (error instanceof ZodError) {
    return {
      statusCode: 400,
      message: 'Validation failed',
      errors: error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })),
    };
  }

  if (error instanceof MongooseError.ValidationError) {
    return {
      statusCode: 400,
      message: 'Validation failed',
      errors: Object.values(error.errors).map((e) => ({ field: e.path, message: e.message })),
    };
  }

  if (error instanceof MongooseError.CastError) {
    return {
      statusCode: 400,
      message: `Invalid value for "${error.path}"`,
      errors: [{ field: error.path, message: `Invalid ${error.kind}` }],
    };
  }

  if (isMongoDuplicateKey(error)) {
    const fields = Object.keys(error.keyValue ?? {});
    return {
      statusCode: 409,
      message: 'Resource already exists',
      errors: fields.map((field) => ({ field, message: `${field} is already in use` })),
    };
  }

  if (error instanceof jwt.TokenExpiredError) {
    return { statusCode: 401, message: 'Token has expired', errors: [] };
  }
  if (error instanceof jwt.JsonWebTokenError) {
    return { statusCode: 401, message: 'Invalid token', errors: [] };
  }

  // Errors raised by Express / body-parser (malformed JSON, payload too large, ...)
  const httpError = error as HttpLikeError;
  const status = httpError?.status ?? httpError?.statusCode;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    if (httpError.type === 'entity.parse.failed') {
      return { statusCode: 400, message: 'Malformed JSON in request body', errors: [] };
    }
    if (httpError.type === 'entity.too.large') {
      return { statusCode: 413, message: 'Request body is too large', errors: [] };
    }
    return { statusCode: status, message: httpError.expose ? httpError.message : 'Bad request', errors: [] };
  }

  return { statusCode: 500, message: 'Internal server error', errors: [] };
};

/**
 * Only whitelisted fields are logged: some errors (e.g. body-parser's) carry the
 * raw request body, which can contain passwords.
 */
const toLoggableError = (error: unknown) => {
  if (!(error instanceof Error)) return { message: String(error) };
  const { code, type } = error as { code?: unknown; type?: unknown };
  return { name: error.name, message: error.message, stack: error.stack, code, type };
};

// Express identifies error middleware by its 4-argument signature.
export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const { statusCode, message, errors } = normalizeError(error);
  const log = req.log ?? logger;

  if (statusCode >= 500) {
    log.error({ err: toLoggableError(error) }, 'Unhandled error');
  } else {
    log.debug({ err: toLoggableError(error), statusCode }, 'Request failed');
  }

  if (res.headersSent) {
    // Too late to send JSON; let Express close the connection.
    res.end();
    return;
  }

  // Stack traces are only ever exposed in development, and only for 5xx errors.
  const stack =
    env.isDevelopment && statusCode >= 500 && error instanceof Error ? error.stack : undefined;

  sendError(res, message, statusCode, errors, stack);
};
