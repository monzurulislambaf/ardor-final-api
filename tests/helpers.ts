import request from 'supertest';
import { createApp } from '../src/app';
import { env } from '../src/config/env';
import { UserModel } from '../src/modules/users/users.model';
import type { UserRole } from '../src/modules/users/users.constants';

export const app = createApp();
export const api = (path: string) => `${env.API_PREFIX}${path}`;

export const strongPassword = 'Passw0rd!secure';

let counter = 0;
export const uniqueEmail = (prefix = 'user') => `${prefix}.${Date.now()}.${counter++}@example.com`;

export interface TestSession {
  id: string;
  email: string;
  password: string;
  accessToken: string;
  /** Raw `Set-Cookie` value for the refresh token. */
  refreshCookie: string;
}

export const extractRefreshCookie = (res: request.Response): string => {
  const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
  const cookie = cookies.find((value) => value.startsWith('refreshToken='));
  if (!cookie) throw new Error('refreshToken cookie was not set');
  return cookie;
};

export const cookieValue = (setCookie: string): string => setCookie.split(';')[0]!;

export const registerUser = async (overrides: Partial<{ name: string; email: string; password: string }> = {}) => {
  const body = {
    name: 'Test User',
    email: uniqueEmail(),
    password: strongPassword,
    ...overrides,
  };
  const res = await request(app).post(api('/auth/register')).send(body);
  return { res, body };
};

export const createSession = async (role: UserRole = 'user'): Promise<TestSession> => {
  const { res, body } = await registerUser();
  if (res.status !== 201) throw new Error(`Registration failed: ${JSON.stringify(res.body)}`);
  if (role !== 'user') await UserModel.updateOne({ email: body.email }, { role });

  // Log in again so the token carries the (possibly elevated) role.
  const login = await request(app).post(api('/auth/login')).send({ email: body.email, password: body.password });
  return {
    id: login.body.data.user.id,
    email: body.email,
    password: body.password,
    accessToken: login.body.data.accessToken,
    refreshCookie: extractRefreshCookie(login),
  };
};

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
