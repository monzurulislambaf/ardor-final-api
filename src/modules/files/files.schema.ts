import { z } from 'zod';
import { paginationQuerySchema } from '../../utils/pagination';
import { FILE_KINDS } from './files.constants';

export const listFilesQuerySchema = paginationQuerySchema.extend({
  kind: z.enum(FILE_KINDS).optional(),
});

export type ListFilesQuery = z.infer<typeof listFilesQuerySchema>;
