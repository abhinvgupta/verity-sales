import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { randomUUID } from 'node:crypto';
import { HydratedDocument } from 'mongoose';

export type LlmDebugLogDocument = HydratedDocument<LlmDebugLog>;

/**
 * Raw LLM outputs that failed Zod validation, preserved for debugging.
 * Written instead of throwing — callers degrade gracefully.
 */
@Schema({ timestamps: true })
export class LlmDebugLog {
  @Prop({ type: String, default: () => randomUUID() })
  _id: string;

  @Prop({ type: String, ref: 'Company', required: true, index: true })
  companyId: string;

  /** What produced this output, e.g. "objection_resolution:pricing". */
  @Prop({ type: String, required: true })
  context: string;

  @Prop({ type: String, required: true })
  rawLlmOutput: string;

  /** Stringified validation errors. */
  @Prop()
  validationError?: string;
}

export const LlmDebugLogSchema = SchemaFactory.createForClass(LlmDebugLog);

// INDEX REQUIRED: debugging lookups are by company + context, newest first.
LlmDebugLogSchema.index({ companyId: 1, context: 1, createdAt: -1 });
