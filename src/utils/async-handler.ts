import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Wraps an async route handler so rejected promises are forwarded to the
 * central error middleware. (Express 5 does this natively; the wrapper keeps
 * the intent explicit and typed.)
 */
export const asyncHandler =
  <Req extends Request = Request>(
    handler: (req: Req, res: Response, next: NextFunction) => Promise<unknown> | unknown,
  ): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(handler(req as Req, res, next)).catch(next);
  };
