import { z } from 'zod';
import { PAGINATION } from '@verity/shared';

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(PAGINATION.MAX_LIMIT).default(PAGINATION.DEFAULT_LIMIT),
});

export type PaginationDto = z.infer<typeof PaginationSchema>;
