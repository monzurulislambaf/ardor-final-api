import { type HydratedDocument, model, Schema, type Types } from 'mongoose';
import { baseSchemaOptions } from '../../utils/mongoose';
import { DOCUMENT_TYPES, FILE_KINDS, type DocumentType, type FileKind } from './files.constants';

export interface IFile {
  owner: Types.ObjectId;
  /** Sanitised name the client uploaded; used only for display and download. */
  originalName: string;
  /** Random name on disk inside UPLOAD_DIR. Never exposed through the API. */
  storedName: string;
  /** Detected from the content, not supplied by the client. */
  mimeType: string;
  extension: string;
  size: number;
  kind: FileKind;
  /** Links the file to an appointment (prescriptions, documents). */
  appointment?: Types.ObjectId;
  documentType?: DocumentType;
  /** Free-text description supplied at upload. */
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type FileDocument = HydratedDocument<IFile>;

const fileSchema = new Schema<IFile>(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    originalName: { type: String, required: true, trim: true, maxlength: 255 },
    storedName: { type: String, required: true, unique: true },
    mimeType: { type: String, required: true },
    extension: { type: String, required: true },
    size: { type: Number, required: true, min: 1 },
    kind: { type: String, enum: FILE_KINDS, required: true },
    appointment: { type: Schema.Types.ObjectId, ref: 'Appointment' },
    documentType: { type: String, enum: DOCUMENT_TYPES },
    description: { type: String, maxlength: 1000 },
  },
  {
    ...baseSchemaOptions,
    toJSON: {
      ...baseSchemaOptions.toJSON,
      transform: (_doc: unknown, ret: Record<string, unknown>) => {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.storedName;
        return ret;
      },
    },
  },
);

fileSchema.index({ owner: 1, createdAt: -1 });
fileSchema.index({ owner: 1, kind: 1, createdAt: -1 });
fileSchema.index({ appointment: 1, createdAt: -1 });

export const FileModel = model<IFile>('File', fileSchema);
