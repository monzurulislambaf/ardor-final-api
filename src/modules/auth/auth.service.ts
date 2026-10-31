import bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { env } from '../../config/env';
import { AppError } from '../../utils/app-error';
import { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken } from '../../utils/jwt';
import { logger } from '../../utils/logger';
import type { UserDocument } from '../users/users.model';
import { usersService } from '../users/users.service';
import { RefreshTokenModel } from './auth.model';
import { sendPasswordResetEmail } from './auth.mailer';
import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from './auth.schema';

export interface ClientMeta {
  userAgent?: string;
  ip?: string;
}

export interface AuthResult {
  user: UserDocument;
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

// Compared against when the email is unknown so response time doesn't reveal which emails exist.
let dummyHash: Promise<string> | undefined;
const getDummyHash = (): Promise<string> => (dummyHash ??= bcrypt.hash('not-a-real-password', env.BCRYPT_ROUNDS));

const assertAccountActive = (user: Pick<UserDocument, 'status'>): void => {
  if (user.status !== 'active') {
    throw AppError.forbidden(`Your account is ${user.status}. Please contact support.`);
  }
};

const revokeFamily = (family: string, reason: string) =>
  RefreshTokenModel.updateMany({ family, revokedAt: null }, { $set: { revokedAt: new Date(), revokedReason: reason } });

const revokeAllForUser = (userId: string, reason: string) =>
  RefreshTokenModel.updateMany({ user: userId, revokedAt: null }, { $set: { revokedAt: new Date(), revokedReason: reason } });

/** Creates a refresh token record (new family unless one is given) and an access token. */
const issueTokens = async (
  user: UserDocument,
  meta: ClientMeta,
  family: string = randomUUID(),
  previousJti?: string,
): Promise<AuthResult> => {
  const refresh = signRefreshToken(user.id, family);

  if (previousJti) {
    // Atomically claim the old token: only one concurrent request can win the rotation.
    const claimed = await RefreshTokenModel.findOneAndUpdate(
      { jti: previousJti, revokedAt: null },
      { $set: { revokedAt: new Date(), revokedReason: 'rotated', replacedByJti: refresh.jti } },
    );
    if (!claimed) {
      await revokeFamily(family, 'reuse-detected');
      throw AppError.unauthorized('Refresh token reuse detected. Please sign in again.');
    }
  }

  await RefreshTokenModel.create({
    user: user._id,
    jti: refresh.jti,
    family,
    tokenHash: sha256(refresh.token),
    expiresAt: refresh.expiresAt,
    userAgent: meta.userAgent?.slice(0, 512),
    ip: meta.ip,
  });

  const accessToken = signAccessToken({ sub: user.id, role: user.role, tv: user.tokenVersion ?? 0 });

  return {
    user,
    accessToken,
    refreshToken: refresh.token,
    refreshTokenExpiresAt: refresh.expiresAt,
  };
};

export const authService = {
  async register(input: RegisterInput, meta: ClientMeta): Promise<AuthResult> {
    // Public registration can never choose a role; it always gets the default one.
    const user = await usersService.create({ name: input.name, email: input.email, password: input.password });
    return issueTokens(user, meta);
  },

  async login(input: LoginInput, meta: ClientMeta): Promise<AuthResult> {
    const user = await usersService.findByEmailWithPassword(input.email);

    if (!user) {
      await bcrypt.compare(input.password, await getDummyHash());
      throw AppError.unauthorized('Invalid email or password');
    }

    const passwordMatches = await user.comparePassword(input.password);
    if (!passwordMatches) throw AppError.unauthorized('Invalid email or password');

    assertAccountActive(user);

    user.lastLoginAt = new Date();
    await user.save();

    return issueTokens(user, meta);
  },

  /** Rotates a refresh token. Reusing an already-rotated token revokes the whole family. */
  async refresh(rawToken: string | undefined, meta: ClientMeta): Promise<AuthResult> {
    if (!rawToken) throw AppError.unauthorized('Refresh token is required');

    const payload = verifyRefreshToken(rawToken);
    const stored = await RefreshTokenModel.findOne({ jti: payload.jti });

    if (!stored || stored.tokenHash !== sha256(rawToken) || String(stored.user) !== payload.sub) {
      throw AppError.unauthorized('Invalid refresh token');
    }

    if (stored.revokedAt) {
      // A token that was already rotated/revoked is being presented again: assume theft.
      await revokeFamily(stored.family, 'reuse-detected');
      logger.warn({ userId: payload.sub, family: stored.family }, 'Refresh token reuse detected');
      throw AppError.unauthorized('Refresh token reuse detected. Please sign in again.');
    }

    const user = await usersService.findForAuth(payload.sub);
    if (!user) {
      await revokeFamily(stored.family, 'user-missing');
      throw AppError.unauthorized('Invalid refresh token');
    }
    if (user.status !== 'active') {
      await revokeFamily(stored.family, 'account-inactive');
      assertAccountActive(user);
    }

    return issueTokens(user, meta, stored.family, stored.jti);
  },

  /** Idempotent: an unknown, expired or missing token simply results in nothing to revoke. */
  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    try {
      const payload = verifyRefreshToken(rawToken);
      await revokeFamily(payload.fam, 'logout');
    } catch {
      // Already invalid/expired: the session is effectively over.
    }
  },

  async logoutAll(userId: string): Promise<void> {
    await usersService.bumpTokenVersion(userId);
    await revokeAllForUser(userId, 'logout-all');
  },

  /** Validates an access token and returns the safe subset kept on `req.user`. */
  async authenticateAccessToken(token: string): Promise<Express.AuthUser> {
    const payload = verifyAccessToken(token);
    const user = await usersService.findForAuth(payload.sub);

    if (!user) throw AppError.unauthorized('User no longer exists');
    if ((user.tokenVersion ?? 0) !== payload.tv) throw AppError.unauthorized('Token has been revoked');
    assertAccountActive(user);

    return { id: user.id, email: user.email, name: user.name, role: user.role };
  },

  getCurrentUser(userId: string): Promise<UserDocument> {
    return usersService.getById(userId);
  },

  async changePassword(userId: string, input: ChangePasswordInput, meta: ClientMeta): Promise<AuthResult> {
    const user = await usersService.findByIdWithPassword(userId);
    if (!user) throw AppError.unauthorized('User no longer exists');

    const matches = await user.comparePassword(input.currentPassword);
    if (!matches) throw AppError.badRequest('Current password is incorrect', [{ field: 'currentPassword', message: 'Incorrect password' }]);

    user.password = input.newPassword;
    user.tokenVersion = (user.tokenVersion ?? 0) + 1; // invalidates every existing access token
    await user.save();
    await revokeAllForUser(user.id, 'password-change');

    // Keep the current device signed in with fresh credentials.
    return issueTokens(user, meta);
  },

  /** Always resolves the same way, so callers cannot learn which emails are registered. */
  async forgotPassword(input: ForgotPasswordInput): Promise<void> {
    const user = await usersService.findByEmailForReset(input.email);
    if (!user || user.status !== 'active') return;

    const resetToken = randomBytes(32).toString('hex');
    user.passwordResetTokenHash = sha256(resetToken);
    user.passwordResetExpiresAt = new Date(Date.now() + env.PASSWORD_RESET_EXPIRES_MINUTES * 60 * 1000);
    await user.save();

    try {
      await sendPasswordResetEmail({ email: user.email, name: user.name }, resetToken);
    } catch (error) {
      logger.error({ err: error, userId: user.id }, 'Failed to send password reset email');
    }
  },

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const user = await usersService.findByResetTokenHash(sha256(input.token));

    if (!user || !user.passwordResetExpiresAt || user.passwordResetExpiresAt.getTime() < Date.now()) {
      throw AppError.badRequest('Reset token is invalid or has expired');
    }

    user.password = input.newPassword;
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpiresAt = undefined;
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    await user.save();
    await revokeAllForUser(user.id, 'password-reset');
  },
};
