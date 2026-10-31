import { z } from 'zod';
import { paginationQuerySchema } from '../../utils/pagination';
import { ENQUIRY_STATUSES, ENQUIRY_TOPICS } from './enquiries.constants';

export const createEnquirySchema = z.object({
  name: z.string().trim().min(2).max(200),
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  phone: z.string().trim().max(30).optional(),
  subject: z.string().trim().min(3).max(500),
  message: z.string().trim().min(10).max(5000),
  topic: z.enum(ENQUIRY_TOPICS).default('general'),
});

export const updateEnquirySchema = z.object({
  status: z.enum(ENQUIRY_STATUSES).optional(),
  adminNotes: z.string().max(2000).optional(),
}).refine(
  (value) => Object.keys(value).length > 0,
  { message: 'Provide at least one field to update' },
);

export const listEnquiriesQuerySchema = paginationQuerySchema.extend({
  status: z.enum(ENQUIRY_STATUSES).optional(),
  topic: z.enum(ENQUIRY_TOPICS).optional(),
});

export type CreateEnquiryInput = z.infer<typeof createEnquirySchema>;
export type UpdateEnquiryInput = z.infer<typeof updateEnquirySchema>;
export type ListEnquiriesQuery = z.infer<typeof listEnquiriesQuerySchema>;
