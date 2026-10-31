import { rateLimit } from 'express-rate-limit';
import { env } from '../config/env';
import { sendError } from '../utils/api-response';

interface LimiterOptions {
  windowMs?: number;
  max?: number;
  message?: string;
}

/** Factory so modules can add their own limits (e.g. OTP or booking endpoints). */
export const createRateLimiter = ({
  windowMs = env.RATE_LIMIT_WINDOW_MS,
  max = env.RATE_LIMIT_MAX,
  message = 'Too many requests, please try again later',
}: LimiterOptions = {}) =>
  rateLimit({
    windowMs,
    limit: max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, res) => {
      sendError(res, message, 429);
    },
  });

export const globalRateLimiter = createRateLimiter();

/** Stricter limiter for credential endpoints (brute-force protection). */
export const authRateLimiter = createRateLimiter({
  max: env.AUTH_RATE_LIMIT_MAX,
  message: 'Too many authentication attempts, please try again later',
});
