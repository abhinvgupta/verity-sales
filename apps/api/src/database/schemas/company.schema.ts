import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { randomUUID } from 'node:crypto';
import { HydratedDocument } from 'mongoose';

export type CompanyDocument = HydratedDocument<Company>;

@Schema({ timestamps: true })
export class Company {
  @Prop({ type: String, default: () => randomUUID() })
  _id: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true })
  slug: string;

  @Prop({ default: 'starter' })
  plan: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const CompanySchema = SchemaFactory.createForClass(Company);
