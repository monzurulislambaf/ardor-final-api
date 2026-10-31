import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';
import { AppError, type ErrorDetail } from '../utils/app-error';

interface RequestSchemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

/**
 * Validates (and coerces/strips) body, query and params with Zod.
 * Parsed values replace the originals, so handlers can trust their shape.
 *
 *   router.post('/', validate({ body: createSchema }), controller.create);
 */
export const validate =
  (schemas: RequestSchemas) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const errors: ErrorDetail[] = [];

    for (const location of ['params', 'query', 'body'] as const) {
      const schema = schemas[location];
      if (!schema) continue;

      const result = schema.safeParse(req[location]);
      if (!result.success) {
        for (const issue of result.error.issues) {
          const path = [location, ...issue.path.map(String)].join('.');
          errors.push({ field: path, message: issue.message });
        }
        continue;
      }

      if (location === 'query') {
        // `req.query` is a read-only getter in Express 5, so redefine it.
        Object.defineProperty(req, 'query', {
          value: result.data,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      } else {
        req[location] = result.data;
      }
    }

    if (errors.length > 0) {
      return next(new AppError('Validation failed', 400, errors));
    }
    next();
  };
