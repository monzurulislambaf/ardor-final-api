import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globalSetup: ['./tests/global-setup.ts'],
    setupFiles: ['./tests/setup.ts'],
    // Booting an in-memory MongoDB the first time can be slow.
    testTimeout: 20_000,
    hookTimeout: 120_000,
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      API_PREFIX: '/api/v1',
      JWT_ACCESS_SECRET: 'test-access-secret-test-access-secret-1234',
      JWT_REFRESH_SECRET: 'test-refresh-secret-test-refresh-secret-5678',
      JWT_ACCESS_EXPIRES_IN: '15m',
      JWT_REFRESH_EXPIRES_IN: '7d',
      CLIENT_ORIGIN: 'http://localhost:3000',
      BCRYPT_ROUNDS: '4',
      // Throwaway upload folder, removed by tests/global-setup.ts.
      UPLOAD_DIR: path.join(os.tmpdir(), `rest-api-starter-uploads-${randomUUID()}`),
      MAX_UPLOAD_SIZE_MB: '1',
      MAX_UPLOAD_FILES: '4',
      RATE_LIMIT_MAX: '100000',
      AUTH_RATE_LIMIT_MAX: '100000',
      // Placeholder so env validation passes; setup.ts replaces it with the in-memory server.
      MONGODB_URI: 'mongodb://127.0.0.1:27017/test',
    },
  },
});
