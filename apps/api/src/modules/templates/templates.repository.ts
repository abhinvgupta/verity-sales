import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PaginationMeta } from '@verity/shared';
import { EvaluationTemplate, EvaluationTemplateDocument } from '../../database/schemas';
import { CreateTemplateDto } from './dto/create-template.dto';

@Injectable()
export class TemplatesRepository {
  constructor(
    @InjectModel(EvaluationTemplate.name)
    private readonly templateModel: Model<EvaluationTemplateDocument>,
  ) {}

  create(
    companyId: string,
    dto: CreateTemplateDto,
  ): Promise<EvaluationTemplateDocument> {
    return this.templateModel.create({ companyId, ...dto, isActive: false });
  }

  async findAll(
    companyId: string,
    page: number,
    limit: number,
  ): Promise<{ data: EvaluationTemplateDocument[]; meta: PaginationMeta }> {
    const filter = { companyId };
    const [data, total] = await Promise.all([
      this.templateModel
        .find(filter)
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ createdAt: -1 })
        .exec(),
      this.templateModel.countDocuments(filter),
    ]);
    return { data, meta: { page, limit, total } };
  }

  findActive(companyId: string): Promise<EvaluationTemplateDocument | null> {
    return this.templateModel.findOne({ companyId, isActive: true }).exec();
  }

  findById(
    id: string,
    companyId: string,
  ): Promise<EvaluationTemplateDocument | null> {
    return this.templateModel.findOne({ _id: id, companyId }).exec();
  }

  deactivateAll(companyId: string): Promise<unknown> {
    return this.templateModel
      .updateMany({ companyId }, { isActive: false })
      .exec();
  }

  activate(
    id: string,
    companyId: string,
  ): Promise<EvaluationTemplateDocument | null> {
    return this.templateModel
      .findOneAndUpdate({ _id: id, companyId }, { isActive: true }, { new: true })
      .exec();
  }
}
