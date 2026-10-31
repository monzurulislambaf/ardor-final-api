import type { Response } from 'express';
import type { ErrorDetail } from './app-error';
import type { PaginationMeta } from './pagination';

export interface SuccessBody<T = unknown> {
  success: true;
  message: string;
  data: T;
  meta?: { pagination: PaginationMeta };
}

export interface ErrorBody {
  success: false;
  message: string;
  errors: ErrorDetail[];
  stack?: string;
}

export const sendSuccess = <T>(
  res: Response,
  data: T,
  message = 'Operation successful',
  statusCode = 200,
  meta?: SuccessBody['meta'],
): Response => {
  const body: SuccessBody<T> = { success: true, message, data };
  if (meta) body.meta = meta;
  return res.status(statusCode).json(body);
};

export const sendCreated = <T>(res: Response, data: T, message = 'Resource created successfully') =>
  sendSuccess(res, data, message, 201);

export const sendPaginated = <T>(
  res: Response,
  items: T[],
  pagination: PaginationMeta,
  message = 'Operation successful',
) => sendSuccess(res, items, message, 200, { pagination });

export const sendError = (
  res: Response,
  message: string,
  statusCode = 500,
  errors: ErrorDetail[] = [],
  stack?: string,
): Response => {
  const body: ErrorBody = { success: false, message, errors };
  if (stack) body.stack = stack;
  return res.status(statusCode).json(body);
};
