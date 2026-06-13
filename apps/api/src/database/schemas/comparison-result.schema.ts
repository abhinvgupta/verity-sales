import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { randomUUID } from 'node:crypto';
import { HydratedDocument } from 'mongoose';
import { ComparisonFinding, ComparisonStatus } from '@verity/shared';

export type ComparisonResultDocument = HydratedDocument<ComparisonResult>;

@Schema({ timestamps: true })
export class ComparisonResult {
  @Prop({ type: String, default: () => randomUUID() })
  _id: string;

  @Prop({ type: String, ref: 'Call', required: true, unique: true })
  callId: string;

  @Prop({ type: String, ref: 'Company', required: true, index: true })
  companyId: string;

  @Prop({
    type: String,
    enum: ['success', 'validation_failed', 'llm_error'],
    required: true,
  })
  comparisonStatus: ComparisonStatus;

  @Prop({ min: 0, max: 100 })
  alignmentScore?: number;

  @Prop({ type: [Object], default: [] })
  findings: ComparisonFinding[];

  // Only populated on failure (validation_failed), for debugging.
  @Prop()
  rawLlmOutput?: string;
}

export const ComparisonResultSchema =
  SchemaFactory.createForClass(ComparisonResult);
