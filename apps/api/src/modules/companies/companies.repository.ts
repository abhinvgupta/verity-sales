import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PaginationMeta } from '@verity/shared';
import { Company, CompanyDocument } from '../../database/schemas';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompaniesRepository {
  constructor(
    @InjectModel(Company.name)
    private readonly companyModel: Model<CompanyDocument>,
  ) {}

  create(dto: CreateCompanyDto): Promise<CompanyDocument> {
    return this.companyModel.create(dto);
  }

  async findAll(
    page: number,
    limit: number,
  ): Promise<{ data: CompanyDocument[]; meta: PaginationMeta }> {
    const [data, total] = await Promise.all([
      this.companyModel
        .find()
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.companyModel.countDocuments(),
    ]);
    return { data, meta: { page, limit, total } };
  }

  findById(id: string): Promise<CompanyDocument | null> {
    return this.companyModel.findById(id).exec();
  }

  findBySlug(slug: string): Promise<CompanyDocument | null> {
    return this.companyModel.findOne({ slug }).exec();
  }

  update(id: string, dto: UpdateCompanyDto): Promise<CompanyDocument | null> {
    return this.companyModel
      .findByIdAndUpdate(id, dto, { new: true })
      .exec();
  }
}
