import { z } from 'zod';
import { paginationQuerySchema } from '../../utils/pagination';
import { EXPERT_CATEGORIES } from '../experts/experts.constants';
import { APPOINTMENT_STATUSES, APPOINTMENT_TYPES, MEETING_PROVIDERS } from './appointments.constants';

export const createAppointmentSchema = z.object({
  expertId: z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid expert id').optional(),
  clientName: z.string().trim().min(2).max(200),
  clientEmail: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  clientPhone: z.string().trim().min(5).max(30).optional(),
  expertCategory: z.enum(EXPERT_CATEGORIES),
  type: z.enum(APPOINTMENT_TYPES),
  preferredDate: z.coerce.date(),
  preferredTime: z.string().trim().min(3).max(100),
  notes: z.string().max(2000).optional(),
  followUpOf: z.string().regex(/^[a-fA-F0-9]{24}$/).optional(),
  // Optional password for auto-creating a client account
  password: z.string().min(8).max(72).regex(/[A-Za-z]/).regex(/\d/).optional(),
});

export const updateAppointmentSchema = z.object({
  status: z.enum(APPOINTMENT_STATUSES).optional(),
  adminNotes: z.string().max(2000).optional(),
  preferredDate: z.coerce.date().optional(),
  preferredTime: z.string().trim().min(3).max(100).optional(),
  scheduledDate: z.coerce.date().optional(),
  scheduledTime: z.string().trim().min(3).max(100).optional(),
  scheduledEndTime: z.string().trim().min(3).max(100).optional(),
  expert: z.string().regex(/^[a-fA-F0-9]{24}$/).optional(),
  meetingUrl: z.string().url().max(2048).optional(),
  meetingProvider: z.enum(MEETING_PROVIDERS).optional(),
  consultationInstructions: z.string().max(2000).optional(),
}).refine(
  (value) => Object.keys(value).length > 0,
  { message: 'Provide at least one field to update' },
);

/** Expert-only consultation record update (notes, diagnosis, treatment). */
export const expertConsultationUpdateSchema = z.object({
  meetingUrl: z.string().url().max(2048).optional(),
  meetingProvider: z.enum(MEETING_PROVIDERS).optional(),
  consultationInstructions: z.string().max(2000).optional(),
  consultationNotes: z.string().max(5000).optional(),
  diagnosisNotes: z.string().max(5000).optional(),
  treatmentPlan: z.string().max(5000).optional(),
  followUpRecommendation: z.string().max(2000).optional(),
  status: z.enum(APPOINTMENT_STATUSES).optional(),
}).refine(
  (value) => Object.keys(value).length > 0,
  { message: 'Provide at least one field to update' },
);

export const expertStatusUpdateSchema = z.object({
  status: z.enum(APPOINTMENT_STATUSES),
});

export const listAppointmentsQuerySchema = paginationQuerySchema.extend({
  status: z.enum(APPOINTMENT_STATUSES).optional(),
  expertCategory: z.enum(EXPERT_CATEGORIES).optional(),
  search: z.string().optional(),
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;
export type ExpertConsultationUpdateInput = z.infer<typeof expertConsultationUpdateSchema>;
export type ListAppointmentsQuery = z.infer<typeof listAppointmentsQuerySchema>;
