import type { Request, Response } from 'express';
import { sendCreated, sendPaginated, sendSuccess } from '../../utils/api-response';
import { asyncHandler } from '../../utils/async-handler';
import type { IdParams } from '../../utils/object-id';
import { usersService } from './users.service';
import type { ListUsersQuery } from './users.schema';

// `req.user` is guaranteed by the `authenticate` middleware on every route.
const actor = (req: Request) => req.user!;

export const usersController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const { items, pagination } = await usersService.list(req.query as unknown as ListUsersQuery);
    sendPaginated(res, items, pagination, 'Users retrieved successfully');
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const user = await usersService.getById((req.params as IdParams).id);
    sendSuccess(res, user, 'User retrieved successfully');
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const user = await usersService.create(req.body);
    sendCreated(res, user, 'User created successfully');
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const user = await usersService.update((req.params as IdParams).id, req.body, actor(req).id);
    sendSuccess(res, user, 'User updated successfully');
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await usersService.remove((req.params as IdParams).id, actor(req).id);
    sendSuccess(res, null, 'User deleted successfully');
  }),

  getProfile: asyncHandler(async (req: Request, res: Response) => {
    const user = await usersService.getById(actor(req).id);
    sendSuccess(res, user, 'Profile retrieved successfully');
  }),

  updateProfile: asyncHandler(async (req: Request, res: Response) => {
    const user = await usersService.updateProfile(actor(req).id, req.body);
    sendSuccess(res, user, 'Profile updated successfully');
  }),
};
