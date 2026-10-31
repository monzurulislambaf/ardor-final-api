import type { CookieOptions, Request, Response } from 'express';
import { env } from '../../config/env';
import { sendCreated, sendSuccess } from '../../utils/api-response';
import { asyncHandler } from '../../utils/async-handler';
import { authService, type AuthResult, type ClientMeta } from './auth.service';

export const REFRESH_COOKIE_NAME = 'refreshToken';

const baseCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: env.cookieSecure,
  sameSite: env.COOKIE_SAME_SITE,
  // Only sent to the auth endpoints, never to the rest of the API.
  path: `${env.API_PREFIX === '/' ? '' : env.API_PREFIX}/auth`,
  domain: env.COOKIE_DOMAIN,
});

const setRefreshCookie = (res: Response, result: AuthResult): void => {
  res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, {
    ...baseCookieOptions(),
    expires: result.refreshTokenExpiresAt,
  });
};

const clearRefreshCookie = (res: Response): void => {
  res.clearCookie(REFRESH_COOKIE_NAME, baseCookieOptions());
};

const clientMeta = (req: Request): ClientMeta => ({
  userAgent: req.get('user-agent'),
  ip: req.ip,
});

const readRefreshToken = (req: Request): string | undefined =>
  (req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined) ?? req.body?.refreshToken;

/** Body returned after any call that starts or renews a session. */
const sessionPayload = (result: AuthResult) => ({
  user: result.user,
  accessToken: result.accessToken,
});

export const authController = {
  register: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.register(req.body, clientMeta(req));
    setRefreshCookie(res, result);
    sendCreated(res, sessionPayload(result), 'Registration successful');
  }),

  login: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.login(req.body, clientMeta(req));
    setRefreshCookie(res, result);
    sendSuccess(res, sessionPayload(result), 'Login successful');
  }),

  refresh: asyncHandler(async (req: Request, res: Response) => {
    try {
      const result = await authService.refresh(readRefreshToken(req), clientMeta(req));
      setRefreshCookie(res, result);
      sendSuccess(res, sessionPayload(result), 'Token refreshed successfully');
    } catch (error) {
      clearRefreshCookie(res);
      throw error;
    }
  }),

  logout: asyncHandler(async (req: Request, res: Response) => {
    await authService.logout(readRefreshToken(req));
    clearRefreshCookie(res);
    sendSuccess(res, null, 'Logged out successfully');
  }),

  logoutAll: asyncHandler(async (req: Request, res: Response) => {
    await authService.logoutAll(req.user!.id);
    clearRefreshCookie(res);
    sendSuccess(res, null, 'Logged out from all devices');
  }),

  me: asyncHandler(async (req: Request, res: Response) => {
    const user = await authService.getCurrentUser(req.user!.id);
    sendSuccess(res, user, 'Current user retrieved successfully');
  }),

  changePassword: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.changePassword(req.user!.id, req.body, clientMeta(req));
    setRefreshCookie(res, result);
    sendSuccess(res, sessionPayload(result), 'Password changed successfully');
  }),

  forgotPassword: asyncHandler(async (req: Request, res: Response) => {
    await authService.forgotPassword(req.body);
    sendSuccess(res, null, 'If that email is registered, a password reset link has been sent');
  }),

  resetPassword: asyncHandler(async (req: Request, res: Response) => {
    await authService.resetPassword(req.body);
    clearRefreshCookie(res);
    sendSuccess(res, null, 'Password reset successful. Please sign in with your new password.');
  }),
};
