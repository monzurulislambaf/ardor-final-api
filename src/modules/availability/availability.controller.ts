import type { Request, Response } from 'express';
import { sendCreated, sendSuccess } from '../../utils/api-response';
import { asyncHandler } from '../../utils/async-handler';
import { ExpertModel } from '../experts/experts.model';
import { availabilityService } from './availability.service';
import type { AddUnavailableDateInput, UpsertAvailabilityInput } from './availability.schema';

export const availabilityController = {
  // Expert: get own availability schedule
  listMine: asyncHandler(async (req: Request, res: Response) => {
    const schedule = await availabilityService.listByUserEmail(req.user!.email);
    sendSuccess(res, schedule, 'Availability retrieved successfully');
  }),

  // Expert: upsert a day's availability
  upsert: asyncHandler(async (req: Request, res: Response) => {
    const doc = await availabilityService.upsertByUserEmail(req.user!.email, req.body as UpsertAvailabilityInput);
    sendCreated(res, doc, 'Availability saved successfully');
  }),

  // Expert: remove a day's availability
  deleteDay: asyncHandler(async (req: Request, res: Response) => {
    const dayOfWeek = Number(req.params.day);
    await availabilityService.deleteByUserEmail(req.user!.email, dayOfWeek);
    sendSuccess(res, null, 'Availability removed successfully');
  }),

  // Expert: list own unavailable dates
  listUnavailableMine: asyncHandler(async (req: Request, res: Response) => {
    const expert = await ExpertModel.findOne({ email: req.user!.email.toLowerCase() }).select('_id');
    if (!expert) { sendSuccess(res, [], 'No unavailable dates'); return; }
    const dates = await availabilityService.listUnavailableByExpert(String(expert._id));
    sendSuccess(res, dates, 'Unavailable dates retrieved');
  }),

  // Expert: add an unavailable date
  addUnavailable: asyncHandler(async (req: Request, res: Response) => {
    const doc = await availabilityService.addUnavailableByUserEmail(req.user!.email, req.body as AddUnavailableDateInput);
    sendCreated(res, doc, 'Date blocked successfully');
  }),

  // Expert: remove an unavailable date
  removeUnavailable: asyncHandler(async (req: Request, res: Response) => {
    await availabilityService.removeUnavailableByUserEmail(req.user!.email, req.params.id as string);
    sendSuccess(res, null, 'Date unblocked successfully');
  }),

  // Public / Client: get available slots for an expert on a date
  getSlots: asyncHandler(async (req: Request, res: Response) => {
    const expertId = req.params.expertId as string;
    const dateStr = req.query.date;
    const date = new Date(typeof dateStr === 'string' ? dateStr : '');
    const slots = await availabilityService.getAvailableSlots(expertId, date);
    sendSuccess(res, slots, 'Available slots retrieved');
  }),

  // Admin: get availability for any expert
  listForExpert: asyncHandler(async (req: Request, res: Response) => {
    const schedule = await availabilityService.listByExpert(req.params.expertId as string);
    sendSuccess(res, schedule, 'Availability retrieved successfully');
  }),

  // Admin: upsert availability for any expert
  upsertForExpert: asyncHandler(async (req: Request, res: Response) => {
    const doc = await availabilityService.upsertByExpertId(req.params.expertId as string, req.body as UpsertAvailabilityInput);
    sendCreated(res, doc, 'Availability saved successfully');
  }),
};
