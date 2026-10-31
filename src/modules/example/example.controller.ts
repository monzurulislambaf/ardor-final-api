import type { Request, Response } from 'express';
import { sendCreated, sendPaginated, sendSuccess } from '../../utils/api-response';
import { asyncHandler } from '../../utils/async-handler';
import type { IdParams } from '../../utils/object-id';
import type { ListExamplesQuery } from './example.schema';
import { exampleService } from './example.service';

// `req.user` is guaranteed by the `authenticate` middleware on every route.
const actor = (req: Request) => req.user!;

export const exampleController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const { items, pagination } = await exampleService.list(req.query as unknown as ListExamplesQuery, actor(req));
    sendPaginated(res, items, pagination, 'Examples retrieved successfully');
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const example = await exampleService.getById((req.params as IdParams).id, actor(req));
    sendSuccess(res, example, 'Example retrieved successfully');
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const example = await exampleService.create(req.body, actor(req));
    sendCreated(res, example, 'Example created successfully');
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const example = await exampleService.update((req.params as IdParams).id, req.body, actor(req));
    sendSuccess(res, example, 'Example updated successfully');
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await exampleService.remove((req.params as IdParams).id, actor(req));
    sendSuccess(res, null, 'Example deleted successfully');
  }),
};
