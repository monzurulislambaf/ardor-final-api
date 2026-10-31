import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, inject } from 'vitest';

// Runs before each test file imports the app, so env.ts sees the right database.
const baseUri = inject('mongoUri').replace(/\/?(\?.*)?$/, '/');
process.env.MONGODB_URI = `${baseUri}test_${randomUUID().replace(/-/g, '')}`;

beforeAll(async () => {
  const { connectDatabase } = await import('../src/config/database');
  await connectDatabase();
  // Make sure unique indexes exist before the first test runs.
  const { default: mongoose } = await import('mongoose');
  await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).init()));
});

afterAll(async () => {
  const { default: mongoose } = await import('mongoose');
  if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase();
  const { disconnectDatabase } = await import('../src/config/database');
  await disconnectDatabase();
});
