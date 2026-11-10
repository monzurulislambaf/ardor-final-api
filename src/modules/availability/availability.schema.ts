import { z } from 'zod';

const timeRangeSchema = z.object({
  start: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:MM'),
  end: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:MM'),
});

export const upsertAvailabilitySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  isActive: z.boolean().optional(),
  workingHours: timeRangeSchema,
  appointmentDuration: z.number().int().min(15).max(480).default(60),
  slotInterval: z.number().int().min(5).max(120).default(60),
  breaks: z.array(timeRangeSchema).default([]),
});

export const addUnavailableDateSchema = z.object({
  date: z.coerce.date(),
  reason: z.string().max(500).optional(),
});

export const getSlotsQuerySchema = z.object({
  date: z.coerce.date(),
});

export type UpsertAvailabilityInput = z.infer<typeof upsertAvailabilitySchema>;
export type AddUnavailableDateInput = z.infer<typeof addUnavailableDateSchema>;
export type GetSlotsQuery = z.infer<typeof getSlotsQuerySchema>;
