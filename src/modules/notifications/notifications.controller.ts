import type { Request, Response } from 'express';
import { sendSuccess } from '../../utils/api-response';
import { asyncHandler } from '../../utils/async-handler';
import { notificationsService } from './notifications.service';

export const notificationsController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const result = await notificationsService.listForUser(req.user!.id, page, limit);
    sendSuccess(res, result, 'Notifications retrieved');
  }),

  markRead: asyncHandler(async (req: Request, res: Response) => {
    await notificationsService.markRead(req.params.id as string, req.user!.id);
    sendSuccess(res, null, 'Notification marked as read');
  }),

  markAllRead: asyncHandler(async (req: Request, res: Response) => {
    await notificationsService.markAllRead(req.user!.id);
    sendSuccess(res, null, 'All notifications marked as read');
  }),

  deleteOne: asyncHandler(async (req: Request, res: Response) => {
    await notificationsService.deleteOne(req.params.id as string, req.user!.id);
    sendSuccess(res, null, 'Notification deleted');
  }),

  unreadCount: asyncHandler(async (req: Request, res: Response) => {
    const count = await notificationsService.unreadCount(req.user!.id);
    sendSuccess(res, { count }, 'Unread count retrieved');
  }),
};
