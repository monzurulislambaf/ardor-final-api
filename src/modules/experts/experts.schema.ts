import { z } from 'zod';
import { paginationQuerySchema } from '../../utils/pagination';
import { EXPERT_CATEGORIES, EXPERT_STATUSES } from './experts.constants';

const slugSchema = z.string().trim().min(2).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Must be a valid slug');
const listSchema = z.array(z.string().trim().min(1).max(1000)).max(50);
// Site-relative (/images/..., /media/...) or absolute http(s) URLs only — never javascript: or data:.
const imageSchema = z.string().trim().max(500).regex(/^(\/(?!\/)|https?:\/\/)/, 'Must be a site path or http(s) URL');

export const createExpertSchema = z.object({
  name: z.string().trim().min(2).max(200),
  slug: slugSchema,
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)).optional(),
  phone: z.string().trim().max(30).optional(),
  category: z.enum(EXPERT_CATEGORIES),
  title: z.string().trim().min(2).max(200),
  initials: z.string().trim().min(1).max(10),
  shortBio: z.string().trim().min(10).max(1000),
  bio: z.array(z.string().trim().min(1).max(5000)).max(30).default([]),
  specialisms: listSchema.default([]),
  qualifications: listSchema.default([]),
  image: imageSchema.or(z.literal('')).optional(),
  imagePosition: z.string().max(50).regex(/^[\w\s%.-]*$/, 'Use a CSS position like "50% 0%"').default('50% 0%'),
  location: z.string().trim().min(2).max(200),
  languages: listSchema.default([]),
  availability: z.string().max(500).optional(),
  fee: z.string().max(100).optional(),
  featured: z.boolean().default(false),
  order: z.number().int().default(0),
  status: z.enum(EXPERT_STATUSES).default('active'),
  affiliations: listSchema.optional(),
  placements: listSchema.optional(),
  publications: listSchema.optional(),
  experienceYears: z.string().trim().max(50).optional(),
  registrationNumber: z.string().max(100).optional(),
  consultationFee: z.number().positive().optional(),
  consultationTypes: listSchema.optional(),
  expertiseCountries: listSchema.optional(),
  forensicSpecialties: listSchema.optional(),
  suitableFor: listSchema.optional(),
  standards: z.string().trim().max(1000).optional(),
  turnaround: z.string().trim().max(500).optional(),
  trainingTopics: listSchema.optional(),
  focus: z.string().max(500).optional(),
  skills: listSchema.optional(),
});

export const updateExpertSchema = createExpertSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: 'Provide at least one field to update' },
);

export const listExpertsQuerySchema = paginationQuerySchema.extend({
  category: z.enum(EXPERT_CATEGORIES).optional(),
  status: z.enum(EXPERT_STATUSES).optional(),
  featured: z.stringbool().optional(),
});

export const publicExpertsQuerySchema = z.object({
  category: z.enum(EXPERT_CATEGORIES).optional(),
  featured: z.stringbool().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type CreateExpertInput = z.infer<typeof createExpertSchema>;
export type UpdateExpertInput = z.infer<typeof updateExpertSchema>;
export type ListExpertsQuery = z.infer<typeof listExpertsQuerySchema>;
export type PublicExpertsQuery = z.infer<typeof publicExpertsQuerySchema>;
