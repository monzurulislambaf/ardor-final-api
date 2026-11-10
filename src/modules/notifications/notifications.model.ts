import { type HydratedDocument, model, Schema, type Types } from 'mongoose';
import { baseSchemaOptions } from '../../utils/mongoose';

export const NOTIFICATION_TYPES = [
  'appointment_booked',
  'appointment_confirmed',
  'appointment_cancelled',
  'appointment_rescheduled',
  'appointment_completed',
  'appointment_no_show',
  'meeting_link_added',
  'meeting_link_updated',
  'consultation_started',
  'prescription_uploaded',
  'document_uploaded',
  'follow_up_recommended',
  'general',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface INotification {
  user: Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  /** Optional link to the related resource (e.g. appointment id). */
  resourceId?: Types.ObjectId;
  resourceType?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type NotificationDocument = HydratedDocument<INotification>;

const notificationSchema = new Schema<INotification>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true, maxlength: 200 },
    message: { type: String, required: true, maxlength: 1000 },
    isRead: { type: Boolean, default: false, index: true },
    resourceId: { type: Schema.Types.ObjectId },
    resourceType: { type: String, maxlength: 50 },
  },
  baseSchemaOptions,
);

notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, isRead: 1 });

// Auto-delete notifications older than 90 days
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const NotificationModel = model<INotification>('Notification', notificationSchema);
