import fs from 'node:fs/promises';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { TestProject } from 'vitest/node';

let mongod: MongoMemoryServer | undefined;

/** Starts one in-memory MongoDB for the whole run; each test file gets its own database. */
export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  mongod = await MongoMemoryServer.create();
  project.provide('mongoUri', mongod.getUri());
  const uploadDir = project.config.env?.UPLOAD_DIR as string | undefined;

  return async () => {
    await mongod?.stop();
    // Only ever delete the throwaway folder created by vitest.config.mts.
    if (uploadDir?.includes('rest-api-starter-uploads-')) {
      await fs.rm(uploadDir, { recursive: true, force: true });
    }
  };
}

declare module 'vitest' {
  export interface ProvidedContext {
    mongoUri: string;
  }
}
