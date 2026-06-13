import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { randomUUID } from 'node:crypto';
import { HydratedDocument } from 'mongoose';
import { ExtractionStatus } from '@verity/shared';

export type RepFormDocument = HydratedDocument<RepForm>;

@Schema({ timestamps: true })
export class RepForm {
  @Prop({ type: String, default: () => randomUUID() })
  _id: string;

  @Prop({ type: String, ref: 'Call', required: true, unique: true })
  callId: string;

  @Prop({ type: String, ref: 'Company', required: true, index: true })
  companyId: string;

  @Prop({ type: String, ref: 'User', required: true, index: true })
  repId: string;

  // S3 key of the uploaded scanned form image.
  @Prop({ required: true })
  formImageUrl: string;

  // Structured fields extracted from the form image by the vision LLM.
  // Optional: populated asynchronously after extraction succeeds.
  @Prop({ type: Object })
  datapoints?: Record<string, unknown>;

  @Prop({
    type: String,
    enum: ['pending', 'success', 'validation_failed', 'llm_error'],
    default: 'pending',
  })
  extractionStatus: ExtractionStatus;

  // Only populated on extraction failure (validation_failed), for debugging.
  @Prop()
  rawLlmOutput?: string;

  @Prop({ required: true })
  submittedAt: Date;
}

export const RepFormSchema = SchemaFactory.createForClass(RepForm);
