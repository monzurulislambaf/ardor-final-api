import mongoose from 'mongoose';
import { env } from './env';
import { logger } from '../utils/logger';

// Strip operators from user-supplied filter values (NoSQL injection hardening)
// and reject queries on fields that are not in the schema.
mongoose.set('sanitizeFilter', true);
mongoose.set('strictQuery', true);

let listenersAttached = false;

const attachConnectionListeners = (): void => {
  if (listenersAttached) return;
  listenersAttached = true;

  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
  mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnected'));
  mongoose.connection.on('error', (error) => logger.error({ err: error }, 'MongoDB connection error'));
};

/**
 * Connects to MongoDB once. Throws on failure so the caller (server.ts) can
 * log and exit instead of running without a database.
 */
export const connectDatabase = async (uri: string = env.MONGODB_URI): Promise<typeof mongoose> => {
  attachConnectionListeners();

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10_000,
      maxPoolSize: 20,
      // autoIndex stays on so unique constraints (e.g. user email) always exist.
      // On very large collections, build indexes in a migration and set this to false.
    });
    logger.info({ db: mongoose.connection.name }, 'MongoDB connected');
    return mongoose;
  } catch (error) {
    // Only the message: the driver's error object embeds a large topology dump.
    logger.error({ reason: error instanceof Error ? error.message : String(error) }, 'MongoDB connection failed');
    throw error;
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  if (mongoose.connection.readyState === 0) return;
  await mongoose.disconnect();
  logger.info('MongoDB connection closed');
};

export const isDatabaseReady = (): boolean => mongoose.connection.readyState === 1;
