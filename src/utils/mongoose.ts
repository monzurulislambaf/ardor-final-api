import type { SchemaOptions } from 'mongoose';

/**
 * Shared schema options: timestamps, `id` instead of `_id`/`__v` in JSON.
 * Use in every model: `new Schema({...}, baseSchemaOptions)`.
 */
export const baseSchemaOptions = {
  timestamps: true,
  versionKey: false,
  toJSON: {
    virtuals: true,
    transform: (_doc: unknown, ret: Record<string, unknown>) => {
      ret.id = String(ret._id);
      delete ret._id;
      return ret;
    },
  },
  toObject: { virtuals: true },
} satisfies SchemaOptions;
