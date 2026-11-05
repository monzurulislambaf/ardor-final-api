import type { Request, Response } from 'express';
import { sendSuccess } from '../../utils/api-response';
import { asyncHandler } from '../../utils/async-handler';
import { dashboardService } from './dashboard.service';

export const dashboardController = {
  adminStats: asyncHandler(async (_req: Request, res: Response) => {
    const stats = await dashboardService.getAdminStats();
    sendSuccess(res, stats, 'Dashboard stats retrieved successfully');
  }),

  clientStats: asyncHandler(async (req: Request, res: Response) => {
    const stats = await dashboardService.getClientStats(req.user!.id);
    sendSuccess(res, stats, 'Client dashboard stats retrieved successfully');
  }),

  expertStats: asyncHandler(async (req: Request, res: Response) => {
    const stats = await dashboardService.getExpertStats(req.user!.email);
    sendSuccess(res, stats, 'Expert dashboard stats retrieved successfully');
  }),
};
