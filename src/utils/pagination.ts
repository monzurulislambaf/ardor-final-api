import type { QueryFilter, Model, SortOrder } from 'mongoose';
import { z } from 'zod';

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

/**
 * Common list-query params. Extend it per module:
 *   const listQuerySchema = paginationQuerySchema.extend({ status: z.enum([...]).optional() });
 */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  /** Comma-separated fields, prefix with "-" for descending: `-createdAt,title` */
  sort: z.string().trim().max(200).optional(),
  /** Free-text search across the module's searchable fields. */
  search: z.string().trim().max(100).optional(),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: PaginationMeta;
}

export interface PaginateOptions {
  page: number;
  limit: number;
  sort?: Record<string, SortOrder>;
  select?: string;
  populate?: string | string[];
}

/**
 * Turn "-createdAt,title" into { createdAt: -1, title: 1 }, keeping only
 * fields present in `allowedFields` (prevents sorting on private fields).
 */
export const parseSort = (
  sort: string | undefined,
  allowedFields: readonly string[],
  fallback: Record<string, SortOrder> = { createdAt: -1 },
): Record<string, SortOrder> => {
  if (!sort) return fallback;

  const result: Record<string, SortOrder> = {};
  for (const part of sort.split(',')) {
    const token = part.trim();
    if (!token) continue;
    const direction: SortOrder = token.startsWith('-') ? -1 : 1;
    const field = token.replace(/^[-+]/, '');
    if (allowedFields.includes(field)) result[field] = direction;
  }
  return Object.keys(result).length > 0 ? result : fallback;
};

export const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Build a case-insensitive "contains" filter over several fields.
 * Returns `undefined` when there is nothing to search for.
 */
export const buildSearchFilter = <T>(
  search: string | undefined,
  fields: readonly string[],
): QueryFilter<T> | undefined => {
  if (!search || fields.length === 0) return undefined;
  const pattern = new RegExp(escapeRegex(search), 'i');
  return { $or: fields.map((field) => ({ [field]: pattern })) } as QueryFilter<T>;
};

export const buildPaginationMeta = (total: number, page: number, limit: number): PaginationMeta => {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
};

/** Reusable paginated query for any Mongoose model. */
export const paginate = async <T>(
  model: Model<T>,
  filter: QueryFilter<T>,
  options: PaginateOptions,
): Promise<PaginatedResult<T>> => {
  const { page, limit, sort = { createdAt: -1 }, select, populate } = options;

  let query = model
    .find(filter)
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(limit);
  if (select) query = query.select(select);
  if (populate) query = query.populate(populate);

  const [items, total] = await Promise.all([query.exec(), model.countDocuments(filter).exec()]);

  return { items: items as T[], pagination: buildPaginationMeta(total, page, limit) };
};
