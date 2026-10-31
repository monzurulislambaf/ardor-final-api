import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

// Real environment variables always win over values in .env.
dotenv.config({ quiet: true });

const durationSchema = z
  .string()
  .regex(/^\d+[smhd]$/, 'Must look like 15m, 12h or 7d (number + s|m|h|d)');

const booleanFromString = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true');

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(5000),
    API_PREFIX: z
      .string()
      .regex(/^\/[a-zA-Z0-9/_-]*$/, 'Must start with "/" (e.g. /api/v1)')
      .transform((value) => (value.length > 1 ? value.replace(/\/+$/, '') : value))
      .default('/api/v1'),
    MONGODB_URI: z
      .string()
      .regex(/^mongodb(\+srv)?:\/\//, 'Must be a mongodb:// or mongodb+srv:// URI'),
    JWT_ACCESS_SECRET: z.string().min(32, 'Must be at least 32 characters'),
    JWT_REFRESH_SECRET: z.string().min(32, 'Must be at least 32 characters'),
    JWT_ACCESS_EXPIRES_IN: durationSchema.default('15m'),
    JWT_REFRESH_EXPIRES_IN: durationSchema.default('7d'),
    CLIENT_ORIGIN: z.string().min(1).default('http://localhost:3000'),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),

    // Optional tuning
    BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
    BODY_LIMIT: z.string().default('100kb'),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
    PASSWORD_RESET_EXPIRES_MINUTES: z.coerce.number().int().positive().default(30),
    COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
    COOKIE_DOMAIN: z
      .string()
      .optional()
      .transform((value) => (value ? value : undefined)),
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),
    UPLOAD_DIR: z.string().min(1).default('uploads'),
    MAX_UPLOAD_SIZE_MB: z.coerce.number().positive().max(500).default(5),
    MAX_UPLOAD_FILES: z.coerce.number().int().min(1).max(50).default(10),
    DOCS_ENABLED: booleanFromString.optional(),
  })
  .superRefine((env, ctx) => {
    if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_REFRESH_SECRET'],
        message: 'Must differ from JWT_ACCESS_SECRET',
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => {
      const missing = issue.message.includes('received undefined');
      return `  - ${issue.path.join('.') || '(root)'}: ${missing ? 'is required but not set' : issue.message}`;
    })
    .join('\n');
  // The logger depends on env, so write directly to stderr here.
  process.stderr.write(`\nInvalid environment configuration:\n${details}\n\n`);
  process.stderr.write('Copy .env.example to .env and fix the values listed above.\n\n');
  process.exit(1);
}

const raw = parsed.data;

export const env = {
  ...raw,
  isProduction: raw.NODE_ENV === 'production',
  isDevelopment: raw.NODE_ENV === 'development',
  isTest: raw.NODE_ENV === 'test',
  /** Parsed list of allowed browser origins. */
  clientOrigins: raw.CLIENT_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  /** First origin, used to build links (e.g. password reset). */
  primaryClientOrigin: raw.CLIENT_ORIGIN.split(',')[0]?.trim() ?? 'http://localhost:3000',
  /** Absolute upload directory (relative values resolve against the working directory). */
  uploadDir: path.resolve(process.cwd(), raw.UPLOAD_DIR),
  maxUploadBytes: Math.floor(raw.MAX_UPLOAD_SIZE_MB * 1024 * 1024),
  docsEnabled: raw.DOCS_ENABLED ?? raw.NODE_ENV !== 'production',
  cookieSecure: raw.NODE_ENV === 'production' || raw.COOKIE_SAME_SITE === 'none',
} as const;

export type Env = typeof env;
