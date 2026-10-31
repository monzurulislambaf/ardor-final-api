import { isValidObjectId, Types } from 'mongoose';
import { z } from 'zod';
import { AppError } from './app-error';

/** Zod schema for a 24-char hex ObjectId string. */
export const objectIdSchema = z
  .string()
  .refine((value) => /^[a-fA-F0-9]{24}$/.test(value), { message: 'Invalid id' });

/** `{ id }` route params. */
export const idParamsSchema = z.object({ id: objectIdSchema });
export type IdParams = z.infer<typeof idParamsSchema>;

/** Convert a string/ObjectId into an ObjectId, throwing a 400 on bad input. */
export const toObjectId = (value: string | Types.ObjectId): Types.ObjectId => {
  if (!isValidObjectId(value)) throw AppError.badRequest('Invalid id');
  return new Types.ObjectId(value);
};

/** Compare two ids regardless of whether they are strings or ObjectIds. */
export const sameId = (a: string | Types.ObjectId, b: string | Types.ObjectId): boolean =>
  String(a) === String(b);
