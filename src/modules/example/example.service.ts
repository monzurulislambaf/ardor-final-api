import type { QueryFilter } from 'mongoose';
import { AppError } from '../../utils/app-error';
import { buildSearchFilter, paginate, parseSort } from '../../utils/pagination';
import { type ExampleDocument, ExampleModel, type IExample } from './example.model';
import type { CreateExampleInput, ListExamplesQuery, UpdateExampleInput } from './example.schema';

const SORTABLE_FIELDS = ['createdAt', 'updatedAt', 'title', 'status', 'priority'];
const SEARCHABLE_FIELDS = ['title', 'description'];

/** Roles that may see and manage everybody's records; everyone else only sees their own. */
const PRIVILEGED_ROLES: readonly string[] = ['admin', 'manager'];

const scopeFor = (actor: Express.AuthUser): QueryFilter<IExample> =>
  PRIVILEGED_ROLES.includes(actor.role) ? {} : { owner: actor.id };

/** Loads one record the actor is allowed to see. Foreign records look like "not found". */
const findAccessible = async (id: string, actor: Express.AuthUser): Promise<ExampleDocument> => {
  const example = await ExampleModel.findOne({ _id: id, ...scopeFor(actor) });
  if (!example) throw AppError.notFound('Example not found');
  return example;
};

export const exampleService = {
  async list(query: ListExamplesQuery, actor: Express.AuthUser) {
    const filter: QueryFilter<IExample> = { ...scopeFor(actor) };
    if (query.status) filter.status = query.status;
    if (query.priority) filter.priority = query.priority;
    if (query.tag) filter.tags = query.tag;

    const search = buildSearchFilter<IExample>(query.search, SEARCHABLE_FIELDS);
    if (search) Object.assign(filter, search);

    return paginate(ExampleModel, filter, {
      page: query.page,
      limit: query.limit,
      sort: parseSort(query.sort, SORTABLE_FIELDS),
    });
  },

  getById: findAccessible,

  create(input: CreateExampleInput, actor: Express.AuthUser): Promise<ExampleDocument> {
    return ExampleModel.create({ ...input, owner: actor.id });
  },

  async update(id: string, input: UpdateExampleInput, actor: Express.AuthUser): Promise<ExampleDocument> {
    const example = await findAccessible(id, actor);
    example.set(input);
    return example.save();
  },

  async remove(id: string, actor: Express.AuthUser): Promise<void> {
    const example = await findAccessible(id, actor);
    await example.deleteOne();
  },
};
