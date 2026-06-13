import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserRole } from '@verity/shared';
import { User, UserDocument } from '../../database/schemas';

@Injectable()
export class AuthRepository {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email, isActive: true }).exec();
  }

  createUser(data: {
    companyId: string;
    name: string;
    email: string;
    passwordHash: string;
    role: UserRole;
  }): Promise<UserDocument> {
    return this.userModel.create(data);
  }
}
