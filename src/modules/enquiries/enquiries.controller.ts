import type { Request, Response } from 'express';
import { sendCreated, sendPaginated, sendSuccess } from '../../utils/api-response';
import { asyncHandler } from '../../utils/async-handler';
import type { IdParams } from '../../utils/object-id';
import { enquiriesService } from './enquiries.service';
import type { ListEnquiriesQuery } from './enquiries.schema';

export const enquiriesController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const { items, pagination } = await enquiriesService.list(req.query as unknown as ListEnquiriesQuery);
    sendPaginated(res, items, pagination, 'Enquiries retrieved successfully');
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const enquiry = await enquiriesService.getById((req.params as IdParams).id);
    sendSuccess(res, enquiry, 'Enquiry retrieved successfully');
  }),

  // Public: submit an enquiry
  create: asyncHandler(async (req: Request, res: Response) => {
    const enquiry = await enquiriesService.create(req.body);
    sendCreated(res, enquiry, 'Enquiry submitted successfully');
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const enquiry = await enquiriesService.update((req.params as IdParams).id, req.body);
    sendSuccess(res, enquiry, 'Enquiry updated successfully');
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await enquiriesService.remove((req.params as IdParams).id);
    sendSuccess(res, null, 'Enquiry deleted successfully');
  }),

  stats: asyncHandler(async (_req: Request, res: Response) => {
    const counts = await enquiriesService.countByStatus();
    sendSuccess(res, counts, 'Enquiry stats retrieved successfully');
  }),
};
