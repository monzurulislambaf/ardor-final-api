import { type HydratedDocument, model, Schema, type Types } from 'mongoose';
import { baseSchemaOptions } from '../../utils/mongoose';

export const EXAMPLE_STATUSES = ['draft', 'active', 'archived'] as const;
export type ExampleStatus = (typeof EXAMPLE_STATUSES)[number];

export const EXAMPLE_PRIORITIES = ['low', 'medium', 'high'] as const;
export type ExamplePriority = (typeof EXAMPLE_PRIORITIES)[number];

export interface IExample {
  title: string;
  description?: string;
  status: ExampleStatus;
  priority: ExamplePriority;
  tags: string[];
  owner: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type ExampleDocument = HydratedDocument<IExample>;

const exampleSchema = new Schema<IExample>(
  {
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 2000 },
    status: { type: String, enum: EXAMPLE_STATUSES, default: 'draft' },
    priority: { type: String, enum: EXAMPLE_PRIORITIES, default: 'medium' },
    tags: { type: [String], default: [] },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  baseSchemaOptions,
);

// Matches the most common list query: "my items, filtered by status, newest first".
exampleSchema.index({ owner: 1, status: 1, createdAt: -1 });
exampleSchema.index({ priority: 1 });

export const ExampleModel = model<IExample>('Example', exampleSchema);
