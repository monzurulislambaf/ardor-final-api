import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '../../config/env';
import { AppError } from '../../utils/app-error';
import { logger } from '../../utils/logger';
import { detectType } from '../files/files.service';

/** Only this folder is served publicly (at /media); private uploads stay elsewhere. */
export const PUBLIC_MEDIA_DIR = path.join(env.uploadDir, 'public');
const PHOTO_DIR = path.join(PUBLIC_MEDIA_DIR, 'experts');
const PHOTO_URL_PREFIX = '/media/experts/';

const unlinkQuietly = async (filePath: string): Promise<void> => {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      logger.warn({ err: { message: (error as Error).message }, filePath }, 'Could not remove file');
    }
  }
};

export const expertPhotos = {
  /** Validates the upload by content (JPEG/PNG/WebP/GIF only) and returns its public URL path. */
  async save(upload: Express.Multer.File | undefined): Promise<string> {
    if (!upload) throw AppError.badRequest('Attach an image in the "photo" field');
    try {
      const { extension } = await detectType(upload, { imagesOnly: true });
      await fs.mkdir(PHOTO_DIR, { recursive: true });
      const fileName = `${randomUUID()}.${extension}`;
      await fs.rename(upload.path, path.join(PHOTO_DIR, fileName));
      return `${PHOTO_URL_PREFIX}${fileName}`;
    } finally {
      await unlinkQuietly(upload.path);
    }
  },

  /** Deletes a photo previously returned by `save`; other image values (e.g. /images/...) are left alone. */
  async removeIfUploaded(url: string | undefined): Promise<void> {
    if (!url?.startsWith(PHOTO_URL_PREFIX)) return;
    const fileName = path.basename(url);
    if (fileName !== url.slice(PHOTO_URL_PREFIX.length)) return;
    await unlinkQuietly(path.join(PHOTO_DIR, fileName));
  },
};
