import { z } from 'zod';

export const AnalyticsQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  repId: z.string().optional(),
});

export type AnalyticsQueryDto = z.infer<typeof AnalyticsQuerySchema>;
