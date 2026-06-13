import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { randomUUID } from 'node:crypto';
import { HydratedDocument } from 'mongoose';
import { UserRole } from '@verity/shared';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  @Prop({ type: String, default: () => randomUUID() })
  _id: string;

  @Prop({ type: String, ref: 'Company', required: true, index: true })
  companyId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  email: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({
    type: String,
    enum: ['super_admin', 'company_admin', 'manager', 'rep'],
    required: true,
  })
  role: UserRole;

  @Prop({ default: true })
  isActive: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ companyId: 1, role: 1 });
