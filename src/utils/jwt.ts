import { randomUUID } from 'node:crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from './app-error';

const ALGORITHM = 'HS256';
const ISSUER = 'rest-api-starter';

export interface AccessTokenPayload {
  sub: string;
  role: string;
  /** User.tokenVersion at issue time; bumping it revokes all access tokens. */
  tv: number;
}

export interface RefreshTokenPayload {
  sub: string;
  /** Unique token id (matches RefreshToken.jti in the database). */
  jti: string;
  /** Token family: every rotation of one login shares a family id. */
  fam: string;
}

type Expiry = NonNullable<SignOptions['expiresIn']>;

export const signAccessToken = (payload: AccessTokenPayload): string =>
  jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    algorithm: ALGORITHM,
    issuer: ISSUER,
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as Expiry,
  });

export interface SignedRefreshToken {
  token: string;
  jti: string;
  expiresAt: Date;
}

export const signRefreshToken = (userId: string, familyId: string): SignedRefreshToken => {
  const jti = randomUUID();
  const token = jwt.sign({ sub: userId, jti, fam: familyId }, env.JWT_REFRESH_SECRET, {
    algorithm: ALGORITHM,
    issuer: ISSUER,
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as Expiry,
  });
  const { exp } = jwt.decode(token) as { exp: number };
  return { token, jti, expiresAt: new Date(exp * 1000) };
};

const verify = <T>(token: string, secret: string, label: string): T => {
  try {
    return jwt.verify(token, secret, { algorithms: [ALGORITHM], issuer: ISSUER }) as T;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw AppError.unauthorized(`${label} has expired`);
    }
    throw AppError.unauthorized(`Invalid ${label.toLowerCase()}`);
  }
};

export const verifyAccessToken = (token: string): AccessTokenPayload & jwt.JwtPayload =>
  verify(token, env.JWT_ACCESS_SECRET, 'Access token');

export const verifyRefreshToken = (token: string): RefreshTokenPayload & jwt.JwtPayload =>
  verify(token, env.JWT_REFRESH_SECRET, 'Refresh token');
