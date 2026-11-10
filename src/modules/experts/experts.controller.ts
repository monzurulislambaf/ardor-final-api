import type { Request, Response } from 'express';
import { sendCreated, sendPaginated, sendSuccess } from '../../utils/api-response';
import { asyncHandler } from '../../utils/async-handler';
import type { IdParams } from '../../utils/object-id';
import { expertsService } from './experts.service';
import type { ListExpertsQuery, PublicExpertsQuery } from './experts.schema';

export const expertsController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const { items, pagination } = await expertsService.list(req.query as unknown as ListExpertsQuery);
    sendPaginated(res, items, pagination, 'Experts retrieved successfully');
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const expert = await expertsService.getById((req.params as IdParams).id);
    sendSuccess(res, expert, 'Expert retrieved successfully');
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const expert = await expertsService.create(req.body);
    sendCreated(res, expert, 'Expert created successfully');
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const expert = await expertsService.update((req.params as IdParams).id, req.body);
    sendSuccess(res, expert, 'Expert updated successfully');
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await expertsService.remove((req.params as IdParams).id);
    sendSuccess(res, null, 'Expert deleted successfully');
  }),

  // Public endpoints (no auth required)
  listPublic: asyncHandler(async (req: Request, res: Response) => {
    const experts = await expertsService.listPublic(req.query as unknown as PublicExpertsQuery);
    sendSuccess(res, experts, 'Experts retrieved successfully');
  }),

  uploadPhoto: asyncHandler(async (req: Request, res: Response) => {
    const url = await expertsService.uploadPhoto((req.files as Express.Multer.File[] | undefined)?.[0]);
    sendCreated(res, { url }, 'Photo uploaded successfully');
  }),

  getFeatured: asyncHandler(async (_req: Request, res: Response) => {
    const experts = await expertsService.listFeatured();
    sendSuccess(res, experts, 'Featured experts retrieved successfully');
  }),

  getBySlug: asyncHandler(async (req: Request, res: Response) => {
    const expert = await expertsService.getBySlug(req.params.slug as string);
    sendSuccess(res, expert, 'Expert retrieved successfully');
  }),

  countByCategory: asyncHandler(async (_req: Request, res: Response) => {
    const counts = await expertsService.countByCategory();
    sendSuccess(res, counts, 'Expert counts retrieved successfully');
  }),

  getMe: asyncHandler(async (req: Request, res: Response) => {
    const expert = await expertsService.getMe(req.user!.email);
    sendSuccess(res, expert, 'Expert profile retrieved successfully');
  }),

  updateMe: asyncHandler(async (req: Request, res: Response) => {
    const expert = await expertsService.updateMe(req.user!.email, req.body);
    sendSuccess(res, expert, 'Expert profile updated successfully');
  }),
};
