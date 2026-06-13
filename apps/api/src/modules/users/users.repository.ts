import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PaginationMeta, UserRole } from '@verity/shared';
import { User, UserDocument } from '../../database/schemas';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersRepository {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  create(data: {
    companyId: string;
    name: string;
    email: string;
    passwordHash: string;
    role: UserRole;
  }): Promise<UserDocument> {
    return this.userModel.create(data);
  }

  async findAll(
    companyId: string,
    page: number,
    limit: number,
  ): Promise<{ data: UserDocument[]; meta: PaginationMeta }> {
    const filter = { companyId };
    const [data, total] = await Promise.all([
      this.userModel
        .find(filter)
        .select('-passwordHash')
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.userModel.countDocuments(filter),
    ]);
    return { data, meta: { page, limit, total } };
  }

  findById(id: string, companyId: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ _id: id, companyId })
      .select('-passwordHash')
      .exec();
  }

  findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email }).exec();
  }

  update(
    id: string,
    companyId: string,
    dto: UpdateUserDto,
  ): Promise<UserDocument | null> {
    return this.userModel
      .findOneAndUpdate({ _id: id, companyId }, dto, { new: true })
      .select('-passwordHash')
      .exec();
  }

  deactivate(id: string, companyId: string): Promise<UserDocument | null> {
    return this.userModel
      .findOneAndUpdate(
        { _id: id, companyId },
        { isActive: false },
        { new: true },
      )
      .select('-passwordHash')
      .exec();
  }
}
