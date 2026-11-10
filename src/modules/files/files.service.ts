import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { QueryFilter } from 'mongoose';
import { env } from '../../config/env';
import { AppError } from '../../utils/app-error';
import { logger } from '../../utils/logger';
import { buildSearchFilter, paginate, parseSort } from '../../utils/pagination';
import {
  DOCUMENT_MIME_TYPES,
  DOCUMENT_TYPES,
  type DocumentType,
  type FileKind,
  IMAGE_MIME_TYPES,
  TEXT_EXTENSIONS,
} from './files.constants';
import { AppointmentModel } from '../appointments/appointments.model';
import { ExpertModel } from '../experts/experts.model';
import { type FileDocument, FileModel, type IFile } from './files.model';
import type { ListFilesQuery } from './files.schema';

const SORTABLE_FIELDS = ['createdAt', 'originalName', 'size', 'mimeType', 'kind'];
const SEARCHABLE_FIELDS = ['originalName'];
const PRIVILEGED_ROLES: readonly string[] = ['admin', 'manager'];

interface DetectedType {
  mimeType: string;
  extension: string;
  kind: FileKind;
}

interface UploadOptions {
  /** Restrict the endpoint to images only. */
  imagesOnly?: boolean;
}

const scopeFor = (actor: Express.AuthUser): QueryFilter<IFile> =>
  PRIVILEGED_ROLES.includes(actor.role) ? {} : { owner: actor.id };

const removeQuietly = async (filePath: string): Promise<void> => {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      logger.warn({ err: { message: (error as Error).message }, filePath }, 'Could not remove file');
    }
  }
};

export const resolveStoredPath = (storedName: string): string => path.join(env.uploadDir, storedName);

/** Strip directories and control characters; the name is only ever used for display/download. */
export const sanitizeFileName = (name: string): string => {
  const base = path.basename(name.replace(/\\/g, '/'));
  // eslint-disable-next-line no-control-regex
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return (cleaned || 'file').slice(0, 255);
};

// file-type is ESM-only; a dynamic import() keeps this CommonJS project working on every Node version.
type FileTypeModule = typeof import('file-type');
let fileTypeModule: Promise<FileTypeModule> | undefined;
const loadFileType = (): Promise<FileTypeModule> => (fileTypeModule ??= import('file-type'));

const looksLikeText = async (filePath: string): Promise<boolean> => {
  const handle = await fs.open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(8192);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    const sample = buffer.subarray(0, bytesRead);
    if (sample.includes(0)) return false;
    // `stream: true` tolerates a multi-byte character cut off at the end of the sample.
    new TextDecoder('utf-8', { fatal: true }).decode(sample, { stream: true });
    return true;
  } catch {
    return false;
  } finally {
    await handle.close();
  }
};

/** Identify the file from its content and check it against the allow-lists. */
export const detectType = async (
  file: Express.Multer.File,
  { imagesOnly }: UploadOptions,
): Promise<DetectedType> => {
  const { fileTypeFromFile } = await loadFileType();
  const detected = await fileTypeFromFile(file.path);

  if (detected) {
    const imageExt = IMAGE_MIME_TYPES[detected.mime];
    if (imageExt) return { mimeType: detected.mime, extension: imageExt, kind: 'image' };

    const documentExt = DOCUMENT_MIME_TYPES[detected.mime];
    if (documentExt && !imagesOnly) return { mimeType: detected.mime, extension: documentExt, kind: 'document' };
  } else if (!imagesOnly) {
    const textExt = path.extname(file.originalname).slice(1).toLowerCase();
    const textMime = TEXT_EXTENSIONS[textExt];
    if (textMime && (await looksLikeText(file.path))) {
      return { mimeType: textMime, extension: textExt, kind: 'document' };
    }
  }

  const allowed = imagesOnly ? 'JPEG, PNG, WebP, GIF' : 'JPEG, PNG, WebP, GIF, PDF, DOCX, XLSX, PPTX, ZIP, TXT, CSV';
  throw new AppError(`Unsupported file type for "${sanitizeFileName(file.originalname)}". Allowed: ${allowed}`, 415);
};

/** Owner or privileged roles only. Used for mutating access (delete). */
const findAccessible = async (id: string, actor: Express.AuthUser): Promise<FileDocument> => {
  const file = await FileModel.findOne({ _id: id, ...scopeFor(actor) });
  if (!file) throw AppError.notFound('File not found');
  return file;
};

/**
 * A file attached to an appointment may be read by that appointment's members — the client who
 * booked it and the expert assigned to it — not only the uploader. Experts are matched by email,
 * the same way appointment listings match them.
 */
const canReadAppointmentFile = async (file: FileDocument, actor: Express.AuthUser): Promise<boolean> => {
  if (!file.appointment) return false;
  const appt = await AppointmentModel.findById(file.appointment).select('user expert');
  if (!appt) return false;
  if (appt.user && String(appt.user) === actor.id) return true;
  if (actor.role === 'expert' && appt.expert) {
    const expert = await ExpertModel.findById(appt.expert).select('email');
    if (expert?.email && expert.email.toLowerCase() === actor.email.toLowerCase()) return true;
  }
  return false;
};

/**
 * Read access: the uploader, a privileged role, or a member of the file's appointment. Non-members'
 * files look like "not found". Used for download/view/metadata, never for delete.
 */
const findReadable = async (id: string, actor: Express.AuthUser): Promise<FileDocument> => {
  const file = await FileModel.findById(id);
  if (!file) throw AppError.notFound('File not found');
  if (
    PRIVILEGED_ROLES.includes(actor.role) ||
    String(file.owner) === actor.id ||
    (await canReadAppointmentFile(file, actor))
  ) {
    return file;
  }
  throw AppError.notFound('File not found');
};

export const filesService = {
  /**
   * Validates every uploaded temp file by content, then stores them all.
   * All-or-nothing: if any file is rejected, nothing is kept.
   */
  async saveUploads(
    uploads: Express.Multer.File[] | undefined,
    actor: Express.AuthUser,
    options: UploadOptions = {},
  ): Promise<FileDocument[]> {
    if (!uploads || uploads.length === 0) throw AppError.badRequest('No files were uploaded');

    const movedPaths: string[] = [];
    try {
      const prepared: { upload: Express.Multer.File; type: DetectedType }[] = [];
      for (const upload of uploads) {
        if (upload.size === 0) {
          throw AppError.badRequest(`"${sanitizeFileName(upload.originalname)}" is empty`);
        }
        prepared.push({ upload, type: await detectType(upload, options) });
      }

      const documents: FileDocument[] = [];
      for (const { upload, type } of prepared) {
        const storedName = `${randomUUID()}.${type.extension}`;
        await fs.rename(upload.path, resolveStoredPath(storedName));
        movedPaths.push(resolveStoredPath(storedName));

        documents.push(
          new FileModel({
            owner: actor.id,
            originalName: sanitizeFileName(upload.originalname),
            storedName,
            mimeType: type.mimeType,
            extension: type.extension,
            size: upload.size,
            kind: type.kind,
          }),
        );
      }

      await FileModel.insertMany(documents);
      return documents;
    } catch (error) {
      await Promise.all([...uploads.map((u) => removeQuietly(u.path)), ...movedPaths.map(removeQuietly)]);
      throw error;
    }
  },

  async list(query: ListFilesQuery, actor: Express.AuthUser) {
    const filter: QueryFilter<IFile> = { ...scopeFor(actor) };
    if (query.kind) filter.kind = query.kind;

    const search = buildSearchFilter<IFile>(query.search, SEARCHABLE_FIELDS);
    if (search) Object.assign(filter, search);

    return paginate(FileModel, filter, {
      page: query.page,
      limit: query.limit,
      sort: parseSort(query.sort, SORTABLE_FIELDS),
    });
  },

  getById: findReadable,

  /** Returns the record for streaming; `storedName` is resolved against UPLOAD_DIR by the caller. */
  async getForDownload(id: string, actor: Express.AuthUser) {
    const file = await findReadable(id, actor);
    try {
      await fs.access(resolveStoredPath(file.storedName));
    } catch {
      throw AppError.notFound('File content is no longer available');
    }
    return file;
  },

  async remove(id: string, actor: Express.AuthUser): Promise<void> {
    const file = await findAccessible(id, actor);
    await file.deleteOne();
    await removeQuietly(resolveStoredPath(file.storedName));
  },

  /** List all documents attached to an appointment. */
  async listForAppointment(appointmentId: string): Promise<FileDocument[]> {
    return FileModel.find({ appointment: appointmentId }).sort({ createdAt: -1 });
  },

  /** Upload documents attached to an appointment (expert uploads prescription/report etc.). */
  async saveAppointmentDocuments(
    uploads: Express.Multer.File[] | undefined,
    actor: Express.AuthUser,
    appointmentId: string,
    documentType: DocumentType = 'other',
    description?: string,
  ): Promise<FileDocument[]> {
    if (!uploads || uploads.length === 0) throw AppError.badRequest('No files were uploaded');

    const movedPaths: string[] = [];
    try {
      const prepared: { upload: Express.Multer.File; type: DetectedType }[] = [];
      for (const upload of uploads) {
        if (upload.size === 0) throw AppError.badRequest(`"${sanitizeFileName(upload.originalname)}" is empty`);
        prepared.push({ upload, type: await detectType(upload, {}) });
      }

      const documents: FileDocument[] = [];
      for (const { upload, type } of prepared) {
        const storedName = `${randomUUID()}.${type.extension}`;
        await fs.rename(upload.path, resolveStoredPath(storedName));
        movedPaths.push(resolveStoredPath(storedName));
        documents.push(
          new FileModel({
            owner: actor.id,
            originalName: sanitizeFileName(upload.originalname),
            storedName,
            mimeType: type.mimeType,
            extension: type.extension,
            size: upload.size,
            kind: type.kind,
            appointment: appointmentId,
            documentType: DOCUMENT_TYPES.includes(documentType) ? documentType : 'other',
            description,
          }),
        );
      }

      await FileModel.insertMany(documents);
      return documents;
    } catch (error) {
      await Promise.all([...uploads.map((u) => removeQuietly(u.path)), ...movedPaths.map(removeQuietly)]);
      throw error;
    }
  },
};
