import { type HydratedDocument, model, Schema, type Types } from 'mongoose';
import { baseSchemaOptions } from '../../utils/mongoose';

export interface IConsultantUnavailableDate {
  expert: Types.ObjectId;
  date: Date;
  reason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ConsultantUnavailableDateDocument = HydratedDocument<IConsultantUnavailableDate>;

const unavailableDateSchema = new Schema<IConsultantUnavailableDate>(
  {
    expert: { type: Schema.Types.ObjectId, ref: 'Expert', required: true, index: true },
    date: { type: Date, required: true },
    reason: { type: String, maxlength: 500 },
  },
  baseSchemaOptions,
);

unavailableDateSchema.index({ expert: 1, date: 1 }, { unique: true });

export const ConsultantUnavailableDateModel = model<IConsultantUnavailableDate>(
  'ConsultantUnavailableDate',
  unavailableDateSchema,
);
