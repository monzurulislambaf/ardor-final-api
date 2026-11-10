import type { Request, Response } from 'express';
import { env } from '../../config/env';
import { sendCreated, sendPaginated, sendSuccess } from '../../utils/api-response';
import { AppError } from '../../utils/app-error';
import { asyncHandler } from '../../utils/async-handler';
import type { IdParams } from '../../utils/object-id';
import { AppointmentModel } from '../appointments/appointments.model';
import { notificationsService } from '../notifications/notifications.service';
import type { DocumentType } from './files.constants';
import type { ListFilesQuery } from './files.schema';
import { filesService } from './files.service';

// `req.user` is guaranteed by the `authenticate` middleware on every route.
const actor = (req: Request) => req.user!;

const sendFileOrNotFound = (res: Response, next: (error?: unknown) => void) => (error?: Error) => {
  // Headers may already be sent if the client aborted mid-download; only react to early failures.
  if (error && !res.headersSent) next(AppError.notFound('File content is no longer available'));
};

export const filesController = {
  uploadImages: asyncHandler(async (req: Request, res: Response) => {
    const files = await filesService.saveUploads(req.files as Express.Multer.File[], actor(req), {
      imagesOnly: true,
    });
    sendCreated(res, files, `${files.length} image(s) uploaded successfully`);
  }),

  uploadFiles: asyncHandler(async (req: Request, res: Response) => {
    const files = await filesService.saveUploads(req.files as Express.Multer.File[], actor(req));
    sendCreated(res, files, `${files.length} file(s) uploaded successfully`);
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    const { items, pagination } = await filesService.list(req.query as unknown as ListFilesQuery, actor(req));
    sendPaginated(res, items, pagination, 'Files retrieved successfully');
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const file = await filesService.getById((req.params as IdParams).id, actor(req));
    sendSuccess(res, file, 'File retrieved successfully');
  }),

  /** Forces a download (Content-Disposition: attachment) using the original file name. */
  download: asyncHandler(async (req: Request, res: Response, next) => {
    const file = await filesService.getForDownload((req.params as IdParams).id, actor(req));
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Cache-Control', 'private, no-store');
    res.download(file.storedName, file.originalName, { root: env.uploadDir, dotfiles: 'deny' }, sendFileOrNotFound(res, next));
  }),

  /** Displays an image inline (for <img> via fetch/blob). Other kinds must be downloaded. */
  view: asyncHandler(async (req: Request, res: Response, next) => {
    const file = await filesService.getForDownload((req.params as IdParams).id, actor(req));
    if (file.kind !== 'image') {
      throw AppError.badRequest('Only images can be viewed inline. Use the download endpoint instead.');
    }
    res.sendFile(
      file.storedName,
      {
        root: env.uploadDir,
        dotfiles: 'deny',
        headers: {
          'Content-Type': file.mimeType,
          'Content-Disposition': 'inline',
          'Cache-Control': 'private, max-age=300',
        },
      },
      sendFileOrNotFound(res, next),
    );
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await filesService.remove((req.params as IdParams).id, actor(req));
    sendSuccess(res, null, 'File deleted successfully');
  }),

  /** List all documents attached to a specific appointment. */
  listAppointmentDocuments: asyncHandler(async (req: Request, res: Response) => {
    const appointmentId = req.params.appointmentId as string;
    const files = await filesService.listForAppointment(appointmentId);
    sendSuccess(res, files, 'Documents retrieved successfully');
  }),

  /** Upload documents (prescription, lab result, etc.) for an appointment. */
  uploadAppointmentDocuments: asyncHandler(async (req: Request, res: Response) => {
    const appointmentId = req.params.appointmentId as string;
    const documentType = (req.body?.documentType as DocumentType) || 'other';
    const description = req.body?.description as string | undefined;
    const files = await filesService.saveAppointmentDocuments(
      req.files as Express.Multer.File[],
      actor(req),
      appointmentId,
      documentType,
      description,
    );

    // Notify patient about the new document
    const appt = await AppointmentModel.findById(appointmentId).select('user referenceNumber');
    if (appt?.user) {
      const type = documentType === 'prescription' ? 'prescription_uploaded' : 'document_uploaded';
      notificationsService.create({
        userId: String(appt.user),
        type,
        title: documentType === 'prescription' ? 'New Prescription Added' : 'New Document Added',
        message: `A new ${documentType.replace('_', ' ')} has been added to your appointment ${appt.referenceNumber}.`,
        resourceId: String(appt._id),
        resourceType: 'appointment',
      }).catch(() => { /* non-fatal */ });
    }

    sendCreated(res, files, `${files.length} document(s) uploaded successfully`);
  }),
};
