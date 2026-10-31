import type { QueryFilter } from 'mongoose';
import { AppError } from '../../utils/app-error';
import { buildSearchFilter, paginate, parseSort } from '../../utils/pagination';
import { type IExpert, type ExpertDocument, ExpertModel } from './experts.model';
import { expertPhotos } from './experts.photos';
import type { CreateExpertInput, ListExpertsQuery, PublicExpertsQuery, UpdateExpertInput } from './experts.schema';

const SORTABLE_FIELDS = ['createdAt', 'updatedAt', 'name', 'category', 'order', 'status'];
const SEARCHABLE_FIELDS = ['name', 'title', 'shortBio', 'location'];

const getExpertOrThrow = async (id: string): Promise<ExpertDocument> => {
  const expert = await ExpertModel.findById(id);
  if (!expert) throw AppError.notFound('Expert not found');
  return expert;
};

export const expertsService = {
  async list(query: ListExpertsQuery) {
    const filter: QueryFilter<IExpert> = {};
    if (query.category) filter.category = query.category;
    if (query.status) filter.status = query.status;
    if (query.featured !== undefined) filter.featured = query.featured;

    const search = buildSearchFilter<IExpert>(query.search, SEARCHABLE_FIELDS);
    if (search) Object.assign(filter, search);

    return paginate(ExpertModel, filter, {
      page: query.page,
      limit: query.limit,
      sort: parseSort(query.sort, SORTABLE_FIELDS, { order: 1, createdAt: -1 }),
    });
  },

  getById: getExpertOrThrow,

  async getBySlug(slug: string): Promise<ExpertDocument> {
    const expert = await ExpertModel.findOne({ slug, status: 'active' });
    if (!expert) throw AppError.notFound('Expert not found');
    return expert;
  },

  async listPublic(query: PublicExpertsQuery) {
    const filter: QueryFilter<IExpert> = { status: 'active' };
    if (query.category) filter.category = query.category;
    if (query.featured !== undefined) filter.featured = query.featured;
    return ExpertModel.find(filter).sort({ order: 1, createdAt: -1 }).limit(query.limit);
  },

  async listFeatured(limit = 6) {
    return ExpertModel.find({ status: 'active', featured: true }).sort({ order: 1, createdAt: -1 }).limit(limit);
  },

  async create(input: CreateExpertInput): Promise<ExpertDocument> {
    const existing = await ExpertModel.exists({ slug: input.slug });
    if (existing) {
      throw AppError.conflict('An expert with this slug already exists', [
        { field: 'slug', message: 'slug is already in use' },
      ]);
    }
    return ExpertModel.create(input);
  },

  async update(id: string, input: UpdateExpertInput): Promise<ExpertDocument> {
    const expert = await getExpertOrThrow(id);

    if (input.slug && input.slug !== expert.slug) {
      const existing = await ExpertModel.exists({ slug: input.slug, _id: { $ne: expert._id } });
      if (existing) {
        throw AppError.conflict('An expert with this slug already exists', [
          { field: 'slug', message: 'slug is already in use' },
        ]);
      }
    }

    const previousImage = expert.image;
    Object.assign(expert, input);
    const saved = await expert.save();
    if (previousImage !== saved.image) await expertPhotos.removeIfUploaded(previousImage);
    return saved;
  },

  async remove(id: string): Promise<void> {
    const deleted = await ExpertModel.findByIdAndDelete(id);
    if (!deleted) throw AppError.notFound('Expert not found');
    await expertPhotos.removeIfUploaded(deleted.image);
  },

  uploadPhoto: expertPhotos.save,

  async countByCategory() {
    const result = await ExpertModel.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]);
    const counts: Record<string, number> = {};
    for (const row of result) {
      counts[row._id as string] = row.count as number;
    }
    return counts;
  },
};
