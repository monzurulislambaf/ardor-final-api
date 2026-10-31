import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sendPasswordResetEmail } from '../src/modules/auth/auth.mailer';
import { RefreshTokenModel } from '../src/modules/auth/auth.model';
import { UserModel } from '../src/modules/users/users.model';
import {
  api,
  app,
  bearer,
  cookieValue,
  createSession,
  extractRefreshCookie,
  registerUser,
  strongPassword,
  uniqueEmail,
} from './helpers';

vi.mock('../src/modules/auth/auth.mailer', () => ({
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

describe('POST /auth/register', () => {
  it('creates a user, returns an access token and sets an httpOnly refresh cookie', async () => {
    const { res, body } = await registerUser({ email: 'MixedCase@Example.com' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.user).toMatchObject({
      name: body.name,
      email: 'mixedcase@example.com',
      role: 'user',
      status: 'active',
    });

    const cookie = extractRefreshCookie(res);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\/api\/v1\/auth/);
  });

  it('never exposes password hashes or internal fields', async () => {
    const { res, body } = await registerUser();
    const serialized = JSON.stringify(res.body);

    expect(serialized).not.toContain('password');
    expect(serialized).not.toContain('tokenVersion');
    expect(serialized).not.toContain('$2');

    const stored = await UserModel.findOne({ email: body.email }).select('+password');
    expect(stored?.password).not.toBe(body.password);
    expect(stored?.password).toMatch(/^\$2[aby]\$/);
  });

  it('ignores attempts to self-assign a role', async () => {
    const res = await request(app)
      .post(api('/auth/register'))
      .send({ name: 'Sneaky', email: uniqueEmail(), password: strongPassword, role: 'admin' });

    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('user');
  });

  it('rejects duplicate emails with 409', async () => {
    const { body } = await registerUser();
    const res = await request(app).post(api('/auth/register')).send(body);

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ success: false, message: 'Email is already registered' });
  });

  it('validates input and reports every problem', async () => {
    const res = await request(app)
      .post(api('/auth/register'))
      .send({ name: 'A', email: 'not-an-email', password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    const fields = res.body.errors.map((e: { field: string }) => e.field);
    expect(fields).toEqual(expect.arrayContaining(['body.name', 'body.email', 'body.password']));
  });
});

describe('POST /auth/login', () => {
  it('logs in with valid credentials and records lastLoginAt', async () => {
    const { body } = await registerUser();
    const res = await request(app).post(api('/auth/login')).send({ email: body.email, password: body.password });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.user.lastLoginAt).toEqual(expect.any(String));
  });

  it('gives the same 401 for a wrong password and an unknown email', async () => {
    const { body } = await registerUser();
    const wrongPassword = await request(app)
      .post(api('/auth/login'))
      .send({ email: body.email, password: 'Wrong-password1' });
    const unknownEmail = await request(app)
      .post(api('/auth/login'))
      .send({ email: uniqueEmail('ghost'), password: 'Wrong-password1' });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body).toEqual(unknownEmail.body);
  });

  it.each(['inactive', 'suspended'] as const)('blocks %s accounts with 403', async (status) => {
    const { body } = await registerUser();
    await UserModel.updateOne({ email: body.email }, { status });

    const res = await request(app).post(api('/auth/login')).send({ email: body.email, password: body.password });

    expect(res.status).toBe(403);
    expect(res.body.message).toContain(status);
  });
});

describe('GET /auth/me and access-token checks', () => {
  it('returns the current user for a valid token', async () => {
    const session = await createSession();
    const res = await request(app).get(api('/auth/me')).set(bearer(session.accessToken));

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: session.id, email: session.email });
  });

  it('rejects missing, malformed and forged tokens with 401', async () => {
    const missing = await request(app).get(api('/auth/me'));
    const malformed = await request(app).get(api('/auth/me')).set(bearer('not.a.jwt'));
    const forged = await request(app)
      .get(api('/auth/me'))
      .set(
        bearer(
          'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiIxMjM0NTYiLCJyb2xlIjoiYWRtaW4ifQ.',
        ),
      );

    expect(missing.status).toBe(401);
    expect(malformed.status).toBe(401);
    expect(forged.status).toBe(401);
  });

  it('stops accepting tokens once the account is suspended', async () => {
    const session = await createSession();
    await UserModel.updateOne({ email: session.email }, { status: 'suspended' });

    const res = await request(app).get(api('/auth/me')).set(bearer(session.accessToken));
    expect(res.status).toBe(403);
  });

  it('stops accepting tokens once the user is deleted', async () => {
    const session = await createSession();
    await UserModel.deleteOne({ email: session.email });

    const res = await request(app).get(api('/auth/me')).set(bearer(session.accessToken));
    expect(res.status).toBe(401);
  });
});

describe('refresh token rotation', () => {
  it('rotates the refresh token and issues a working access token', async () => {
    const session = await createSession();
    const res = await request(app).post(api('/auth/refresh')).set('Cookie', cookieValue(session.refreshCookie));

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    const rotated = extractRefreshCookie(res);
    expect(cookieValue(rotated)).not.toBe(cookieValue(session.refreshCookie));

    const me = await request(app).get(api('/auth/me')).set(bearer(res.body.data.accessToken));
    expect(me.status).toBe(200);
  });

  it('stores only a hash of the refresh token', async () => {
    const session = await createSession();
    const token = cookieValue(session.refreshCookie).replace('refreshToken=', '');
    const stored = await RefreshTokenModel.find({ user: session.id });

    expect(stored.length).toBeGreaterThan(0);
    expect(stored.every((doc) => doc.tokenHash !== token && doc.tokenHash.length === 64)).toBe(true);
  });

  it('detects reuse of a rotated token and revokes the whole token family', async () => {
    const session = await createSession();
    const first = cookieValue(session.refreshCookie);

    const rotated = await request(app).post(api('/auth/refresh')).set('Cookie', first);
    expect(rotated.status).toBe(200);
    const second = cookieValue(extractRefreshCookie(rotated));

    // An attacker (or a buggy client) replays the already-used token...
    const replay = await request(app).post(api('/auth/refresh')).set('Cookie', first);
    expect(replay.status).toBe(401);
    expect(replay.body.message).toMatch(/reuse/i);

    // ...so even the legitimate newest token is now dead.
    const afterReuse = await request(app).post(api('/auth/refresh')).set('Cookie', second);
    expect(afterReuse.status).toBe(401);
  });

  it('only lets one of two concurrent refreshes win', async () => {
    const session = await createSession();
    const cookie = cookieValue(session.refreshCookie);

    const results = await Promise.all([
      request(app).post(api('/auth/refresh')).set('Cookie', cookie),
      request(app).post(api('/auth/refresh')).set('Cookie', cookie),
    ]);

    expect(results.map((r) => r.status).sort()).toEqual([200, 401]);
  });

  it('rejects requests without a refresh token and tokens signed with the wrong secret', async () => {
    const none = await request(app).post(api('/auth/refresh'));
    const session = await createSession();
    const accessAsRefresh = await request(app)
      .post(api('/auth/refresh'))
      .send({ refreshToken: session.accessToken });

    expect(none.status).toBe(401);
    expect(accessAsRefresh.status).toBe(401);
  });

  it('refuses to refresh for a suspended account', async () => {
    const session = await createSession();
    await UserModel.updateOne({ email: session.email }, { status: 'suspended' });

    const res = await request(app).post(api('/auth/refresh')).set('Cookie', cookieValue(session.refreshCookie));
    expect(res.status).toBe(403);
  });
});

describe('logout', () => {
  it('revokes the refresh token and clears the cookie', async () => {
    const session = await createSession();
    const cookie = cookieValue(session.refreshCookie);

    const out = await request(app).post(api('/auth/logout')).set('Cookie', cookie);
    expect(out.status).toBe(200);
    expect(extractRefreshCookie(out)).toMatch(/refreshToken=;/);

    const refresh = await request(app).post(api('/auth/refresh')).set('Cookie', cookie);
    expect(refresh.status).toBe(401);
  });

  it('succeeds even without a session', async () => {
    const res = await request(app).post(api('/auth/logout'));
    expect(res.status).toBe(200);
  });

  it('logout-all invalidates access tokens and every refresh token', async () => {
    const session = await createSession();
    const otherDevice = await request(app)
      .post(api('/auth/login'))
      .send({ email: session.email, password: session.password });

    const out = await request(app).post(api('/auth/logout-all')).set(bearer(session.accessToken));
    expect(out.status).toBe(200);

    const me = await request(app).get(api('/auth/me')).set(bearer(session.accessToken));
    const refresh = await request(app)
      .post(api('/auth/refresh'))
      .set('Cookie', cookieValue(extractRefreshCookie(otherDevice)));
    expect(me.status).toBe(401);
    expect(refresh.status).toBe(401);
  });
});

describe('POST /auth/change-password', () => {
  it('rejects a wrong current password', async () => {
    const session = await createSession();
    const res = await request(app)
      .post(api('/auth/change-password'))
      .set(bearer(session.accessToken))
      .send({ currentPassword: 'Not-my-password1', newPassword: 'Brand-new-pass1' });

    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe('currentPassword');
  });

  it('rejects reusing the same password', async () => {
    const session = await createSession();
    const res = await request(app)
      .post(api('/auth/change-password'))
      .set(bearer(session.accessToken))
      .send({ currentPassword: session.password, newPassword: session.password });

    expect(res.status).toBe(400);
  });

  it('changes the password, revokes old credentials and keeps the current session alive', async () => {
    const session = await createSession();
    const newPassword = 'Brand-new-pass1';

    const res = await request(app)
      .post(api('/auth/change-password'))
      .set(bearer(session.accessToken))
      .send({ currentPassword: session.password, newPassword });
    expect(res.status).toBe(200);

    const oldAccess = await request(app).get(api('/auth/me')).set(bearer(session.accessToken));
    const oldRefresh = await request(app)
      .post(api('/auth/refresh'))
      .set('Cookie', cookieValue(session.refreshCookie));
    const newAccess = await request(app).get(api('/auth/me')).set(bearer(res.body.data.accessToken));
    expect(oldAccess.status).toBe(401);
    expect(oldRefresh.status).toBe(401);
    expect(newAccess.status).toBe(200);

    const oldLogin = await request(app)
      .post(api('/auth/login'))
      .send({ email: session.email, password: session.password });
    const newLogin = await request(app).post(api('/auth/login')).send({ email: session.email, password: newPassword });
    expect(oldLogin.status).toBe(401);
    expect(newLogin.status).toBe(200);
  });

  it('requires authentication', async () => {
    const res = await request(app)
      .post(api('/auth/change-password'))
      .send({ currentPassword: 'x', newPassword: 'Brand-new-pass1' });
    expect(res.status).toBe(401);
  });
});

describe('forgot / reset password', () => {
  beforeEach(() => {
    vi.mocked(sendPasswordResetEmail).mockClear();
  });

  const requestResetToken = async (email: string): Promise<string> => {
    await request(app).post(api('/auth/forgot-password')).send({ email }).expect(200);
    const call = vi.mocked(sendPasswordResetEmail).mock.calls.at(-1);
    if (!call) throw new Error('reset email was not sent');
    return call[1];
  };

  it('answers identically for known and unknown emails and only emails known users', async () => {
    const { body } = await registerUser();
    const known = await request(app).post(api('/auth/forgot-password')).send({ email: body.email });
    const unknown = await request(app).post(api('/auth/forgot-password')).send({ email: uniqueEmail('nobody') });

    expect(known.status).toBe(200);
    expect(known.body).toEqual(unknown.body);
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
  });

  it('stores only a hash of the reset token', async () => {
    const { body } = await registerUser();
    const token = await requestResetToken(body.email);
    const stored = await UserModel.findOne({ email: body.email }).select('+passwordResetTokenHash');

    expect(stored?.passwordResetTokenHash).toBeDefined();
    expect(stored?.passwordResetTokenHash).not.toBe(token);
  });

  it('resets the password once, revokes sessions and rejects token reuse', async () => {
    const session = await createSession();
    const token = await requestResetToken(session.email);
    const newPassword = 'Reset-pass-123';

    const reset = await request(app).post(api('/auth/reset-password')).send({ token, newPassword });
    expect(reset.status).toBe(200);

    const login = await request(app).post(api('/auth/login')).send({ email: session.email, password: newPassword });
    const oldRefresh = await request(app)
      .post(api('/auth/refresh'))
      .set('Cookie', cookieValue(session.refreshCookie));
    const oldAccess = await request(app).get(api('/auth/me')).set(bearer(session.accessToken));
    const replay = await request(app).post(api('/auth/reset-password')).send({ token, newPassword: 'Another-pass-123' });
    expect(login.status).toBe(200);
    expect(oldRefresh.status).toBe(401);
    expect(oldAccess.status).toBe(401);
    expect(replay.status).toBe(400);
  });

  it('rejects unknown, expired and weak-password resets', async () => {
    const { body } = await registerUser();
    const token = await requestResetToken(body.email);

    const unknown = await request(app)
      .post(api('/auth/reset-password'))
      .send({ token: 'a'.repeat(64), newPassword: 'Reset-pass-123' });
    const weak = await request(app).post(api('/auth/reset-password')).send({ token, newPassword: 'short' });

    await UserModel.updateOne({ email: body.email }, { passwordResetExpiresAt: new Date(Date.now() - 1000) });
    const expired = await request(app).post(api('/auth/reset-password')).send({ token, newPassword: 'Reset-pass-123' });

    expect(unknown.status).toBe(400);
    expect(weak.status).toBe(400);
    expect(expired.status).toBe(400);
    expect(expired.body.message).toMatch(/invalid or has expired/i);
  });
});
