import { z } from 'zod';

export const ObjectionsQuerySchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  sortBy: z.enum(['count', 'successRate', 'priority']).default('count'),
  search: z.string().trim().max(100).optional(),
});

export type ObjectionsQueryDto = z.infer<typeof ObjectionsQuerySchema>;

export const ResolutionPathQuerySchema = z.object({
  regenerate: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

export type ResolutionPathQueryDto = z.infer<typeof ResolutionPathQuerySchema>;

/** Objection types are snake_case labels produced by the analysis LLM. */
export const ObjectionTypeSchema = z
  .string()
  .regex(/^[a-z0-9_]{1,64}$/, 'must be a snake_case objection type');

/** Shape the resolution-path LLM output must conform to before caching. */
export const ResolutionOutputSchema = z.object({
  winningPatterns: z
    .array(z.object({ pattern: z.string(), description: z.string() }))
    .min(1),
  losingPatterns: z
    .array(z.object({ pattern: z.string(), description: z.string() }))
    .min(1),
  playbook: z.object({
    do: z.array(z.string()).min(1),
    dont: z.array(z.string()).min(1),
    suggestedScript: z.string().min(1),
  }),
});

export type ResolutionOutput = z.infer<typeof ResolutionOutputSchema>;
