import { env } from '../../config/env';
import { logger } from '../../utils/logger';

/**
 * Integration point for transactional email.
 *
 * This starter ships without an email provider. Replace the body of this
 * function with your provider (Resend, SendGrid, SES, Nodemailer, ...).
 * In non-production environments the reset link is written to the log so the
 * flow can be exercised end to end without sending real email.
 */
export const sendPasswordResetEmail = async (
  user: { email: string; name: string },
  resetToken: string,
): Promise<void> => {
  const resetUrl = `${env.primaryClientOrigin}/reset-password?token=${resetToken}`;

  if (env.isProduction) {
    logger.warn(
      { to: user.email },
      'Password reset requested but no email provider is configured (src/modules/auth/auth.mailer.ts)',
    );
    return;
  }

  logger.info({ to: user.email, resetUrl }, 'Password reset link (development only)');
};
