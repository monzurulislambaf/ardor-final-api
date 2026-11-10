import { type HydratedDocument, model, Schema, type Types } from 'mongoose';
import { baseSchemaOptions } from '../../utils/mongoose';

export interface ITimeRange {
  start: string; // "09:00"
  end: string;   // "17:00"
}

export interface IConsultantAvailability {
  expert: Types.ObjectId;
  /** 0 = Sunday, 1 = Monday, ..., 6 = Saturday */
  dayOfWeek: number;
  isActive: boolean;
  workingHours: ITimeRange;
  /** Duration of each appointment slot in minutes (e.g. 60). */
  appointmentDuration: number;
  /** Gap between slots in minutes (e.g. 15). */
  slotInterval: number;
  /** Break periods within the working day. */
  breaks: ITimeRange[];
  createdAt: Date;
  updatedAt: Date;
}

export type ConsultantAvailabilityDocument = HydratedDocument<IConsultantAvailability>;

const timeRangeSchema = new Schema<ITimeRange>(
  {
    start: { type: String, required: true, match: /^\d{2}:\d{2}$/ },
    end: { type: String, required: true, match: /^\d{2}:\d{2}$/ },
  },
  { _id: false },
);

const availabilitySchema = new Schema<IConsultantAvailability>(
  {
    expert: { type: Schema.Types.ObjectId, ref: 'Expert', required: true, index: true },
    dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
    isActive: { type: Boolean, default: true },
    workingHours: { type: timeRangeSchema, required: true },
    appointmentDuration: { type: Number, required: true, min: 15, max: 480, default: 60 },
    slotInterval: { type: Number, required: true, min: 5, max: 120, default: 60 },
    breaks: [timeRangeSchema],
  },
  baseSchemaOptions,
);

availabilitySchema.index({ expert: 1, dayOfWeek: 1 }, { unique: true });

export const ConsultantAvailabilityModel = model<IConsultantAvailability>('ConsultantAvailability', availabilitySchema);
