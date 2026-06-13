import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { randomUUID } from 'node:crypto';
import { HydratedDocument } from 'mongoose';
import { CallStatus } from '@verity/shared';

export type CallDocument = HydratedDocument<Call>;

@Schema({ timestamps: true })
export class Call {
  @Prop({ type: String, default: () => randomUUID() })
  _id: string;

  @Prop({ type: String, ref: 'Company', required: true, index: true })
  companyId: string;

  @Prop({ type: String, ref: 'User', required: true, index: true })
  repId: string;

  @Prop({ required: true })
  transcriptUrl: string;

  @Prop({
    type: String,
    enum: [
      'uploaded',
      'queued',
      'analyzing',
      'analyzed',
      'form_pending',
      'comparing',
      'complete',
      'failed',
    ],
    default: 'uploaded',
  })
  status: CallStatus;

  @Prop()
  failureReason?: string;
}

export const CallSchema = SchemaFactory.createForClass(Call);

CallSchema.index({ companyId: 1, status: 1 });
CallSchema.index({ companyId: 1, repId: 1 });
CallSchema.index({ companyId: 1, createdAt: -1 });
