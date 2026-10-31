import type { QueryFilter } from 'mongoose';
import { AppError } from '../../utils/app-error';
import { buildSearchFilter, paginate, parseSort } from '../../utils/pagination';
import { type IEnquiry, type EnquiryDocument, EnquiryModel } from './enquiries.model';
import type { CreateEnquiryInput, ListEnquiriesQuery, UpdateEnquiryInput } from './enquiries.schema';

const SORTABLE_FIELDS = ['createdAt', 'updatedAt', 'status', 'topic', 'name'];
const SEARCHABLE_FIELDS = ['name', 'email', 'subject', 'message'];

const getEnquiryOrThrow = async (id: string): Promise<EnquiryDocument> => {
  const enquiry = await EnquiryModel.findById(id);
  if (!enquiry) throw AppError.notFound('Enquiry not found');
  return enquiry;
};

export const enquiriesService = {
  async list(query: ListEnquiriesQuery) {
    const filter: QueryFilter<IEnquiry> = {};
    if (query.status) filter.status = query.status;
    if (query.topic) filter.topic = query.topic;

    const search = buildSearchFilter<IEnquiry>(query.search, SEARCHABLE_FIELDS);
    if (search) Object.assign(filter, search);

    return paginate(EnquiryModel, filter, {
      page: query.page,
      limit: query.limit,
      sort: parseSort(query.sort, SORTABLE_FIELDS),
    });
  },

  getById: getEnquiryOrThrow,

  async create(input: CreateEnquiryInput): Promise<EnquiryDocument> {
    return EnquiryModel.create(input);
  },

  async update(id: string, input: UpdateEnquiryInput): Promise<EnquiryDocument> {
    const enquiry = await getEnquiryOrThrow(id);
    if (input.status === 'resolved' && enquiry.status !== 'resolved') {
      enquiry.repliedAt = new Date();
    }
    Object.assign(enquiry, input);
    return enquiry.save();
  },

  async remove(id: string): Promise<void> {
    const deleted = await EnquiryModel.findByIdAndDelete(id);
    if (!deleted) throw AppError.notFound('Enquiry not found');
  },

  async countByStatus() {
    const result = await EnquiryModel.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const counts: Record<string, number> = {};
    for (const row of result) {
      counts[row._id as string] = row.count as number;
    }
    return counts;
  },
};
