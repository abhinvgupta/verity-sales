import { z } from 'zod';

export const CreateCompanySchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  plan: z.string().default('starter'),
});

export type CreateCompanyDto = z.infer<typeof CreateCompanySchema>;
