import { Router } from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { buildOpenApiSpec } from './openapi';

/**
 * Swagger UI + raw spec. Mounted by app.ts at `<API_PREFIX>/docs`.
 * Swagger UI needs inline scripts, so it gets a relaxed CSP of its own;
 * the strict Helmet defaults still apply to every other route.
 */
export const createDocsRouter = (): Router => {
  const router = Router();
  const spec = buildOpenApiSpec();

  router.use(helmet({ contentSecurityPolicy: false }));
  router.get('/openapi.json', (_req, res) => {
    res.json(spec);
  });
  router.use('/', swaggerUi.serve, swaggerUi.setup(spec, { customSiteTitle: 'REST API Starter - Docs' }));

  return router;
};
