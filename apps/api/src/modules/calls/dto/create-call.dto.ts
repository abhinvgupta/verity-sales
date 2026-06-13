import { z } from 'zod';

export const CreateCallSchema = z.object({
  repId: z.string().min(1),
  transcriptText: z.string().min(1),
});

export type CreateCallDto = z.infer<typeof CreateCallSchema>;
