import type { NextFunction, Request, Response } from 'express';
import { authService } from '../modules/auth/auth.service';
import type { UserRole } from '../modules/users/users.constants';
import { AppError } from '../utils/app-error';
import { asyncHandler } from '../utils/async-handler';

const extractBearerToken = (req: Request): string | undefined => {
  const header = req.headers.authorization;
  if (!header) return undefined;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : undefined;
};

/**
 * Requires a valid access token (`Authorization: Bearer <token>`), an existing
 * user and an active account. Attaches `req.user`.
 */
export const authenticate = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const token = extractBearerToken(req);
  if (!token) throw AppError.unauthorized('Authentication required');

  req.user = await authService.authenticateAccessToken(token);
  next();
});

/** Attaches `req.user` when a valid token is present; otherwise continues anonymously. */
export const optionalAuthenticate = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  const token = extractBearerToken(req);
  if (token) {
    try {
      req.user = await authService.authenticateAccessToken(token);
    } catch {
      // An expired or invalid token should not block a public request.
    }
  }
  next();
};

/** Role-based access control. Must run after `authenticate`. */
export const authorize =
  (...roles: UserRole[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(AppError.unauthorized('Authentication required'));
    if (!roles.includes(req.user.role)) {
      return next(AppError.forbidden('You do not have permission to perform this action'));
    }
    next();
  };
