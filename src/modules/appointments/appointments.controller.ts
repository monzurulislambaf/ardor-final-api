import type { Request, Response } from 'express';
import { sendCreated, sendPaginated, sendSuccess } from '../../utils/api-response';
import { asyncHandler } from '../../utils/async-handler';
import type { IdParams } from '../../utils/object-id';
import { appointmentsService } from './appointments.service';
import type { ListAppointmentsQuery } from './appointments.schema';

export const appointmentsController = {
  // Admin: list all appointments
  list: asyncHandler(async (req: Request, res: Response) => {
    const { items, pagination } = await appointmentsService.list(req.query as unknown as ListAppointmentsQuery);
    sendPaginated(res, items, pagination, 'Appointments retrieved successfully');
  }),

  // Client: list own appointments
  listMine: asyncHandler(async (req: Request, res: Response) => {
    const { items, pagination } = await appointmentsService.listByUser(
      req.user!.id,
      req.query as unknown as ListAppointmentsQuery,
    );
    sendPaginated(res, items, pagination, 'Appointments retrieved successfully');
  }),

  // Expert: list appointments assigned to this expert (matched by user email ↔ expert.email)
  listForExpert: asyncHandler(async (req: Request, res: Response) => {
    const { items, pagination } = await appointmentsService.listByExpert(
      req.user!.email,
      req.query as unknown as ListAppointmentsQuery,
    );
    sendPaginated(res, items, pagination, 'Appointments retrieved successfully');
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const appointment = await appointmentsService.getById((req.params as IdParams).id);
    sendSuccess(res, appointment, 'Appointment retrieved successfully');
  }),

  // Public: create appointment (optionally creates a client account)
  create: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const { appointment, autoCreatedUser } = await appointmentsService.create(req.body, userId);
    sendCreated(res, { appointment, autoCreatedUser }, 'Appointment booked successfully');
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const appointment = await appointmentsService.update((req.params as IdParams).id, req.body);
    sendSuccess(res, appointment, 'Appointment updated successfully');
  }),

  updateStatusForExpert: asyncHandler(async (req: Request, res: Response) => {
    const appointment = await appointmentsService.updateStatusByExpert(
      (req.params as IdParams).id,
      req.user!.email,
      req.body.status as string,
    );
    sendSuccess(res, appointment, 'Appointment status updated successfully');
  }),

  cancel: asyncHandler(async (req: Request, res: Response) => {
    const appointment = await appointmentsService.cancel((req.params as IdParams).id, req.user!.id);
    sendSuccess(res, appointment, 'Appointment cancelled successfully');
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await appointmentsService.remove((req.params as IdParams).id);
    sendSuccess(res, null, 'Appointment deleted successfully');
  }),

  stats: asyncHandler(async (_req: Request, res: Response) => {
    const counts = await appointmentsService.countByStatus();
    sendSuccess(res, counts, 'Appointment stats retrieved successfully');
  }),
};
