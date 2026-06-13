import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ExtractionStatus } from '@verity/shared';
import { RepForm, RepFormDocument } from '../../database/schemas';

@Injectable()
export class FormsRepository {
  constructor(
    @InjectModel(RepForm.name)
    private readonly repFormModel: Model<RepFormDocument>,
  ) {}

  create(data: {
    callId: string;
    companyId: string;
    repId: string;
    formImageUrl: string;
    submittedAt: Date;
  }): Promise<RepFormDocument> {
    return this.repFormModel.create({ ...data, extractionStatus: 'pending' });
  }

  findByCallId(
    callId: string,
    companyId: string,
  ): Promise<RepFormDocument | null> {
    return this.repFormModel.findOne({ callId, companyId }).exec();
  }

  /** Records extraction results (or failure) for a form. */
  updateExtraction(
    callId: string,
    companyId: string,
    data: {
      extractionStatus: ExtractionStatus;
      datapoints?: Record<string, unknown>;
      rawLlmOutput?: string;
    },
  ): Promise<RepFormDocument | null> {
    return this.repFormModel
      .findOneAndUpdate({ callId, companyId }, data, { new: true })
      .exec();
  }
}
