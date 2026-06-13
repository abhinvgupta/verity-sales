import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { randomUUID } from 'node:crypto';
import { HydratedDocument } from 'mongoose';
import { AnalysisStatus, ObjectionHandling } from '@verity/shared';

export type CallAnalysisDocument = HydratedDocument<CallAnalysis>;

/** One objection raised by the prospect, extracted by the analysis LLM. */
@Schema({ _id: false })
export class ObjectionEntry {
  /** snake_case label, e.g. "pricing", "brand_recognition". */
  @Prop({ type: String, required: true })
  type: string;

  @Prop({
    type: String,
    enum: ['successful', 'partial', 'unsuccessful', 'ignored'],
    required: true,
  })
  repHandling: ObjectionHandling;

  /** 1-2 sentence summary of how the rep responded. */
  @Prop({ type: String, required: true })
  repResponseSummary: string;

  /** Verbatim 2-3 lines from the transcript. */
  @Prop({ type: String, required: true })
  transcriptExcerpt: string;
}

export const ObjectionEntrySchema =
  SchemaFactory.createForClass(ObjectionEntry);

@Schema({ timestamps: true })
export class CallAnalysis {
  @Prop({ type: String, default: () => randomUUID() })
  _id: string;

  @Prop({ type: String, ref: 'Call', required: true, unique: true })
  callId: string;

  @Prop({ type: String, ref: 'Company', required: true, index: true })
  companyId: string;

  // Only populated on failure (validation_failed / llm_error) for debugging.
  @Prop()
  rawLlmOutput?: string;

  @Prop({ type: Object })
  parsedOutput?: Record<string, unknown>;

  @Prop({ min: 0, max: 100 })
  score?: number;

  /** Objections extracted from parsedOutput, denormalized for aggregation. */
  @Prop({ type: [ObjectionEntrySchema], default: [] })
  objections: ObjectionEntry[];

  @Prop({
    type: String,
    enum: ['success', 'validation_failed', 'llm_error'],
    required: true,
  })
  analysisStatus: AnalysisStatus;
}

export const CallAnalysisSchema = SchemaFactory.createForClass(CallAnalysis);

CallAnalysisSchema.index({ companyId: 1, analysisStatus: 1 });
// INDEX REQUIRED: objection list + resolution-path sample aggregations match
// on companyId + objections.type ($unwind group-by and sample buckets).
CallAnalysisSchema.index({ companyId: 1, 'objections.type': 1 });
// INDEX REQUIRED: resolution-path sample buckets filter by repHandling.
CallAnalysisSchema.index({ companyId: 1, 'objections.repHandling': 1 });
