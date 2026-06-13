import { z } from 'zod';

export const CreateUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['manager', 'rep']),
});

export type CreateUserDto = z.infer<typeof CreateUserSchema>;
