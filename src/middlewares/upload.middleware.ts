import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import multer from 'multer';
import { env } from '../config/env';
import { AppError } from '../utils/app-error';

/** Incoming files land here first; the service validates them before moving them. */
export const TEMP_UPLOAD_DIR = path.join(env.uploadDir, '.tmp');
fs.mkdirSync(TEMP_UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: TEMP_UPLOAD_DIR,
  // Never use the client-supplied name on disk.
  filename: (_req, _file, callback) => callback(null, `${randomUUID()}.upload`),
});

const toAppError = (error: unknown, maxFiles: number): unknown => {
  if (!(error instanceof multer.MulterError)) return error;

  switch (error.code) {
    case 'LIMIT_FILE_SIZE':
      return new AppError(`File is too large (max ${env.MAX_UPLOAD_SIZE_MB} MB per file)`, 413);
    case 'LIMIT_FILE_COUNT':
      return AppError.badRequest(`Too many files (max ${maxFiles} per request)`);
    case 'LIMIT_UNEXPECTED_FILE':
      return AppError.badRequest(`Unexpected file field "${error.field}"`);
    default:
      return AppError.badRequest(`Invalid upload: ${error.message}`);
  }
};

/**
 * Parses `multipart/form-data` files from `fieldName` onto `req.files`.
 * Size and count limits come from env; multer errors become standard AppErrors.
 * Content is NOT trusted here: the service checks the real file type.
 */
export const uploadFiles = (fieldName: string, maxCount: number = env.MAX_UPLOAD_FILES): RequestHandler => {
  const parser = multer({
    storage,
    // Browsers send UTF-8 file names; multer defaults to latin1, which garbles "résumé.pdf".
    defParamCharset: 'utf8',
    limits: { fileSize: env.maxUploadBytes, files: maxCount, fields: 10, parts: maxCount + 10 },
  }).array(fieldName, maxCount);

  return (req: Request, res: Response, next: NextFunction): void => {
    parser(req, res, (error?: unknown) => next(error ? toAppError(error, maxCount) : undefined));
  };
};
