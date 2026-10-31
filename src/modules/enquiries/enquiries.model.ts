import { type HydratedDocument, model, Schema } from 'mongoose';
import { baseSchemaOptions } from '../../utils/mongoose';
import { ENQUIRY_STATUSES, ENQUIRY_TOPICS, type EnquiryStatus, type EnquiryTopic } from './enquiries.constants';

export interface IEnquiry {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  topic: EnquiryTopic;
  status: EnquiryStatus;
  adminNotes?: string;
  repliedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type EnquiryDocument = HydratedDocument<IEnquiry>;

const enquirySchema = new Schema<IEnquiry>(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    phone: { type: String, trim: true, maxlength: 30 },
    subject: { type: String, required: true, trim: true, maxlength: 500 },
    message: { type: String, required: true, maxlength: 5000 },
    topic: { type: String, enum: ENQUIRY_TOPICS, default: 'general', index: true },
    status: { type: String, enum: ENQUIRY_STATUSES, default: 'new', index: true },
    adminNotes: { type: String, maxlength: 2000 },
    repliedAt: { type: Date },
  },
  baseSchemaOptions,
);

enquirySchema.index({ createdAt: -1 });

export const EnquiryModel = model<IEnquiry>('Enquiry', enquirySchema);
