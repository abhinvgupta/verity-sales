import { z } from "zod";

export const SignupSchema = z.object({
  companyName: z.string().min(1).max(100),
  companySlug: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(6),
});

export type SignupDto = z.infer<typeof SignupSchema>;
