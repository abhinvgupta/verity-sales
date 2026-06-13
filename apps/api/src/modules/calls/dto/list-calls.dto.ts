import { z } from 'zod';
import { PAGINATION } from '@verity/shared';

const CALL_STATUSES = [
  'uploaded',
  'queued',
  'analyzing',
  'analyzed',
  'form_pending',
  'comparing',
  'complete',
  'failed',
] as const;

export const ListCallsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(PAGINATION.MAX_LIMIT)
    .default(PAGINATION.DEFAULT_LIMIT),
  repId: z.string().optional(),
  status: z.enum(CALL_STATUSES).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type ListCallsDto = z.infer<typeof ListCallsSchema>;
