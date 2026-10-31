import { type HydratedDocument, model, Schema } from 'mongoose';
import { baseSchemaOptions } from '../../utils/mongoose';
import { EXPERT_CATEGORIES, EXPERT_STATUSES, type ExpertCategory, type ExpertStatus } from './experts.constants';

export interface IExpert {
  name: string;
  slug: string;
  email?: string;
  phone?: string;
  category: ExpertCategory;
  title: string;
  initials: string;
  shortBio: string;
  bio: string[];
  specialisms: string[];
  qualifications: string[];
  image?: string;
  imagePosition: string;
  location: string;
  languages: string[];
  availability: string;
  fee?: string;
  featured: boolean;
  order: number;
  status: ExpertStatus;
  // Credentials shown on the full profile
  affiliations?: string[];
  placements?: string[];
  publications?: string[];
  experienceYears?: string;
  // Psychologist-specific
  registrationNumber?: string;
  consultationFee?: number;
  consultationTypes?: string[];
  // Country-forensic specific
  expertiseCountries?: string[];
  forensicSpecialties?: string[];
  suitableFor?: string[];
  standards?: string;
  turnaround?: string;
  // Training-specific
  trainingTopics?: string[];
  focus?: string;
  skills?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export type ExpertDocument = HydratedDocument<IExpert>;

const expertSchema = new Schema<IExpert>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 200 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 200 },
    email: { type: String, lowercase: true, trim: true, maxlength: 254 },
    phone: { type: String, trim: true, maxlength: 30 },
    category: { type: String, enum: EXPERT_CATEGORIES, required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    initials: { type: String, required: true, trim: true, maxlength: 10 },
    shortBio: { type: String, required: true, maxlength: 1000 },
    bio: [{ type: String }],
    specialisms: [{ type: String }],
    qualifications: [{ type: String }],
    image: { type: String },
    imagePosition: { type: String, default: '50% 0%' },
    location: { type: String, required: true, maxlength: 200 },
    languages: [{ type: String }],
    availability: { type: String, maxlength: 500 },
    fee: { type: String, maxlength: 100 },
    featured: { type: Boolean, default: false, index: true },
    order: { type: Number, default: 0 },
    status: { type: String, enum: EXPERT_STATUSES, default: 'active', index: true },
    affiliations: [{ type: String }],
    placements: [{ type: String }],
    publications: [{ type: String }],
    experienceYears: { type: String, maxlength: 50 },
    registrationNumber: { type: String, maxlength: 100 },
    consultationFee: { type: Number },
    consultationTypes: [{ type: String }],
    expertiseCountries: [{ type: String }],
    forensicSpecialties: [{ type: String }],
    suitableFor: [{ type: String }],
    standards: { type: String, maxlength: 1000 },
    turnaround: { type: String, maxlength: 500 },
    trainingTopics: [{ type: String }],
    focus: { type: String, maxlength: 500 },
    skills: [{ type: String }],
  },
  baseSchemaOptions,
);

expertSchema.index({ category: 1, status: 1, order: 1 });
expertSchema.index({ featured: 1, status: 1 });

export const ExpertModel = model<IExpert>('Expert', expertSchema);
