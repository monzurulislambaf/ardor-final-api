import { z } from 'zod';
import { paginationQuerySchema } from '../../utils/pagination';
import { EXAMPLE_PRIORITIES, EXAMPLE_STATUSES } from './example.model';

const tagsSchema = z
  .array(z.string().trim().min(1).max(30))
  .max(10, 'At most 10 tags are allowed')
  .transform((tags) => [...new Set(tags.map((tag) => tag.toLowerCase()))]);

export const createExampleSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(2000).optional(),
  status: z.enum(EXAMPLE_STATUSES).optional(),
  priority: z.enum(EXAMPLE_PRIORITIES).optional(),
  tags: tagsSchema.optional(),
});

export const updateExampleSchema = createExampleSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: 'Provide at least one field to update' });

export const listExamplesQuerySchema = paginationQuerySchema.extend({
  status: z.enum(EXAMPLE_STATUSES).optional(),
  priority: z.enum(EXAMPLE_PRIORITIES).optional(),
  tag: z.string().trim().toLowerCase().max(30).optional(),
});

export type CreateExampleInput = z.infer<typeof createExampleSchema>;
export type UpdateExampleInput = z.infer<typeof updateExampleSchema>;
export type ListExamplesQuery = z.infer<typeof listExamplesQuerySchema>;
