import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { randomUUID } from "node:crypto";
import { HydratedDocument } from "mongoose";

export type EvaluationTemplateDocument = HydratedDocument<EvaluationTemplate>;

@Schema({ timestamps: true })
export class EvaluationTemplate {
  @Prop({ type: String, default: () => randomUUID() })
  _id: string;

  @Prop({ type: String, ref: "Company", required: true, index: true })
  companyId: string;

  @Prop({ default: false })
  isActive: boolean;

  @Prop({ required: true })
  callAnalysisPrompt: string;

  @Prop({ type: Object, required: true })
  outputSchema: Record<string, unknown>;

  // The factual fields the rep form contains. The form extractor and the
  // comparator both key off this; the prompts themselves are common to all
  // companies and live in code. Stored as a JSON-schema-like object.
  @Prop({ type: Object })
  formSchema?: Record<string, unknown>;
}

export const EvaluationTemplateSchema =
  SchemaFactory.createForClass(EvaluationTemplate);

// Only one active template per company
EvaluationTemplateSchema.index(
  { companyId: 1, isActive: 1 },
  { partialFilterExpression: { isActive: true }, unique: true },
);
