import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createRateLimiter } from '../src/middlewares/rate-limit.middleware';
import { buildOpenApiSpec } from '../src/docs/openapi';
import express from 'express';
import { api, app } from './helpers';

describe('health check', () => {
  it('reports a healthy service with a connected database', async () => {
    const res = await request(app).get(api('/health'));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      message: expect.any(String),
      data: { status: 'ok', database: 'connected' },
    });
  });
});

describe('error responses', () => {
  it('returns the standard 404 body for unknown routes', async () => {
    const res = await request(app).get(api('/does-not-exist'));

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      success: false,
      message: 'Route not found: GET /api/v1/does-not-exist',
      errors: [],
    });
  });

  it('returns 400 for malformed JSON instead of a stack trace', async () => {
    const res = await request(app)
      .post(api('/auth/login'))
      .set('Content-Type', 'application/json')
      .send('{"email": ');

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, message: 'Malformed JSON in request body' });
    expect(res.body.stack).toBeUndefined();
  });

  it('rejects oversized bodies with 413', async () => {
    const res = await request(app)
      .post(api('/auth/login'))
      .send({ email: 'a@b.co', password: 'x'.repeat(200_000) });

    expect(res.status).toBe(413);
    expect(res.body.success).toBe(false);
  });

  it('does not allow NoSQL operator objects in credentials', async () => {
    const res = await request(app)
      .post(api('/auth/login'))
      .send({ email: { $ne: null }, password: { $ne: null } });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors.length).toBeGreaterThan(0);
  });
});

describe('security headers', () => {
  it('sets Helmet headers and hides the framework', async () => {
    const res = await request(app).get(api('/health'));

    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('only allows configured CORS origins', async () => {
    const allowed = await request(app).get(api('/health')).set('Origin', 'http://localhost:3000');
    const blocked = await request(app).get(api('/health')).set('Origin', 'http://evil.example');

    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');
    expect(blocked.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('rate limiting', () => {
  it('answers 429 in the standard error format once the limit is exceeded', async () => {
    const limited = express();
    limited.use(createRateLimiter({ windowMs: 60_000, max: 2 }));
    limited.get('/ping', (_req, res) => {
      res.json({ ok: true });
    });

    await request(limited).get('/ping').expect(200);
    await request(limited).get('/ping').expect(200);
    const res = await request(limited).get('/ping');

    expect(res.status).toBe(429);
    expect(res.body).toMatchObject({ success: false, errors: [] });
  });
});

describe('API documentation', () => {
  it('serves Swagger UI and the OpenAPI document', async () => {
    const ui = await request(app).get(api('/docs/'));
    const spec = await request(app).get(api('/docs/openapi.json'));

    expect(ui.status).toBe(200);
    expect(ui.text).toContain('swagger-ui');
    expect(spec.status).toBe(200);
    expect(spec.body.openapi).toBe('3.0.3');
    expect(Object.keys(spec.body.paths)).toEqual(
      expect.arrayContaining(['/health', '/auth/login', '/users', '/examples/{id}']),
    );
  });

  it('documents request bodies generated from the Zod schemas', () => {
    const spec = buildOpenApiSpec() as {
      paths: Record<string, { post?: { requestBody?: { content: Record<string, { schema: { required?: string[] } }> } } }>;
    };
    const schema = spec.paths['/auth/register']?.post?.requestBody?.content['application/json']?.schema;

    expect(schema?.required).toEqual(expect.arrayContaining(['name', 'email', 'password']));
  });
});
