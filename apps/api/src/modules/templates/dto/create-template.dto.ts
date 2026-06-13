import { z } from 'zod';

export const CreateTemplateSchema = z.object({
  callAnalysisPrompt: z.string().min(1),
  outputSchema: z.record(z.unknown()),
  formSchema: z.record(z.unknown()).optional(),
});

export type CreateTemplateDto = z.infer<typeof CreateTemplateSchema>;
