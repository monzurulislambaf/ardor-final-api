import { z } from 'zod';
import { paginationQuerySchema } from '../../utils/pagination';
import { USER_ROLES, USER_STATUSES } from './users.constants';

/** bcrypt only uses the first 72 bytes, so cap the length to avoid silent truncation. */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .regex(/[A-Za-z]/, 'Password must contain at least one letter')
  .regex(/\d/, 'Password must contain at least one number');

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Invalid email address').max(254));

export const nameSchema = z.string().trim().min(2, 'Name must be at least 2 characters').max(100);

export const createUserSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  role: z.enum(USER_ROLES).optional(),
  status: z.enum(USER_STATUSES).optional(),
});

export const updateUserSchema = z
  .object({
    name: nameSchema.optional(),
    role: z.enum(USER_ROLES).optional(),
    status: z.enum(USER_STATUSES).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'Provide at least one field to update' });

export const updateProfileSchema = z
  .object({ name: nameSchema.optional() })
  .refine((value) => Object.keys(value).length > 0, { message: 'Provide at least one field to update' });

export const listUsersQuerySchema = paginationQuerySchema.extend({
  role: z.enum(USER_ROLES).optional(),
  status: z.enum(USER_STATUSES).optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
