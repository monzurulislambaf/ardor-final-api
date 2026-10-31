import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/app-error';

export const notFoundHandler = (req: Request, _res: Response, next: NextFunction): void => {
  next(AppError.notFound(`Route not found: ${req.method} ${req.path}`));
};
