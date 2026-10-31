import { randomUUID } from 'node:crypto';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env';
import { createDocsRouter } from './docs/swagger';
import { errorHandler } from './middlewares/error.middleware';
import { notFoundHandler } from './middlewares/not-found.middleware';
import { globalRateLimiter } from './middlewares/rate-limit.middleware';
import { PUBLIC_MEDIA_DIR } from './modules/experts/experts.photos';
import routes from './routes';
import { logger } from './utils/logger';

/** Builds the Express app without starting it, so tests can use it with Supertest. */
export const createApp = (): Express => {
  const app = express();

  app.disable('x-powered-by');
  if (env.TRUST_PROXY > 0) app.set('trust proxy', env.TRUST_PROXY);

  // Structured request logging with a correlation id.
  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const incoming = req.headers['x-request-id'];
        const id = typeof incoming === 'string' && /^[\w-]{1,64}$/.test(incoming) ? incoming : randomUUID();
        res.setHeader('X-Request-Id', id);
        return id;
      },
      autoLogging: { ignore: (req) => req.url?.endsWith('/health') ?? false },
      customLogLevel: (_req, res, error) => {
        if (error || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
    }),
  );

  // Swagger UI has its own (relaxed) Helmet config, so mount it before the strict one.
  if (env.docsEnabled) app.use(`${env.API_PREFIX === '/' ? '' : env.API_PREFIX}/docs`, createDocsRouter());

  app.use(helmet());
  app.use(
    cors({
      origin: env.clientOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id'],
      maxAge: 600,
    }),
  );
  app.use(compression());
  app.use(globalRateLimiter);

  app.use(express.json({ limit: env.BODY_LIMIT }));
  app.use(express.urlencoded({ extended: false, limit: env.BODY_LIMIT }));
  app.use(cookieParser());

  // Public media only (expert photos). Private uploads are served through /files with access checks.
  app.use(
    '/media',
    express.static(PUBLIC_MEDIA_DIR, {
      dotfiles: 'deny',
      index: false,
      maxAge: '7d',
      // Helmet defaults to same-origin; the website on another port must be able to embed these images.
      setHeaders: (res) => res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'),
    }),
  );

  app.use(env.API_PREFIX, routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

export default createApp;
