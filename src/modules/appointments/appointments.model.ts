import { type HydratedDocument, model, Schema, type Types } from 'mongoose';
import { baseSchemaOptions } from '../../utils/mongoose';
import { EXPERT_CATEGORIES, type ExpertCategory } from '../experts/experts.constants';
import { APPOINTMENT_STATUSES, APPOINTMENT_TYPES, MEETING_PROVIDERS, type AppointmentStatus, type AppointmentType, type MeetingProvider } from './appointments.constants';

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
  /** Confirmed/scheduled date (may differ from preferred after rescheduling). */
  scheduledDate?: Date;
  scheduledTime?: string;
  scheduledEndTime?: string;
  status: AppointmentStatus;
  notes?: string;
  adminNotes?: string;
  referenceNumber: string;
  // Consultation / session fields
  meetingUrl?: string;
  meetingProvider?: MeetingProvider;
  consultationInstructions?: string;
  /** Expert-only private notes from the session. */
  consultationNotes?: string;
  diagnosisNotes?: string;
  treatmentPlan?: string;
  /** Patient-visible follow-up instructions after the session. */
  followUpRecommendation?: string;
  /** Reference to a previous appointment this is a follow-up for. */
  followUpOf?: Types.ObjectId;
  /** Timestamp when consultation was started. */
  consultationStartedAt?: Date;
  /** Timestamp when consultation was completed. */
  completedAt?: Date;
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
    scheduledDate: { type: Date },
    scheduledTime: { type: String, maxlength: 100 },
    scheduledEndTime: { type: String, maxlength: 100 },
    status: { type: String, enum: APPOINTMENT_STATUSES, default: 'pending', index: true },
    notes: { type: String, maxlength: 2000 },
    adminNotes: { type: String, maxlength: 2000 },
    referenceNumber: { type: String, required: true, unique: true },
    meetingUrl: { type: String, maxlength: 2048, select: false },
    meetingProvider: { type: String, enum: MEETING_PROVIDERS },
    consultationInstructions: { type: String, maxlength: 2000 },
    consultationNotes: { type: String, maxlength: 5000, select: false },
    diagnosisNotes: { type: String, maxlength: 5000, select: false },
    treatmentPlan: { type: String, maxlength: 5000, select: false },
    followUpRecommendation: { type: String, maxlength: 2000 },
    followUpOf: { type: Schema.Types.ObjectId, ref: 'Appointment' },
    consultationStartedAt: { type: Date },
    completedAt: { type: Date },
  },
  baseSchemaOptions,
);

appointmentSchema.index({ createdAt: -1 });
appointmentSchema.index({ clientEmail: 1 });
appointmentSchema.index({ expert: 1, scheduledDate: 1, status: 1 });

export const AppointmentModel = model<IAppointment>('Appointment', appointmentSchema);
