import { type HydratedDocument, model, Schema, type Types } from 'mongoose';
import { baseSchemaOptions } from '../../utils/mongoose';
import { EXPERT_CATEGORIES, type ExpertCategory } from '../experts/experts.constants';
import { APPOINTMENT_STATUSES, APPOINTMENT_TYPES, type AppointmentStatus, type AppointmentType } from './appointments.constants';

export interface IAppointment {
  user?: Types.ObjectId;
  expert?: Types.ObjectId;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  expertCategory: ExpertCategory;
  type: AppointmentType;
  preferredDate: Date;
  preferredTime: string;
  status: AppointmentStatus;
  notes?: string;
  adminNotes?: string;
  referenceNumber: string;
  createdAt: Date;
  updatedAt: Date;
}

export type AppointmentDocument = HydratedDocument<IAppointment>;

const appointmentSchema = new Schema<IAppointment>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    expert: { type: Schema.Types.ObjectId, ref: 'Expert' },
    clientName: { type: String, required: true, trim: true, maxlength: 200 },
    clientEmail: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    clientPhone: { type: String, trim: true, maxlength: 30 },
    expertCategory: { type: String, enum: EXPERT_CATEGORIES, required: true, index: true },
    type: { type: String, enum: APPOINTMENT_TYPES, required: true },
    preferredDate: { type: Date, required: true },
    preferredTime: { type: String, required: true, maxlength: 100 },
    status: { type: String, enum: APPOINTMENT_STATUSES, default: 'pending', index: true },
    notes: { type: String, maxlength: 2000 },
    adminNotes: { type: String, maxlength: 2000 },
    referenceNumber: { type: String, required: true, unique: true },
  },
  baseSchemaOptions,
);

appointmentSchema.index({ createdAt: -1 });
appointmentSchema.index({ clientEmail: 1 });

export const AppointmentModel = model<IAppointment>('Appointment', appointmentSchema);
