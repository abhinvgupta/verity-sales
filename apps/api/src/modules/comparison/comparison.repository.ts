import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ComparisonFinding, ComparisonStatus } from '@verity/shared';
import { ComparisonResult, ComparisonResultDocument } from '../../database/schemas';

@Injectable()
export class ComparisonRepository {
  constructor(
    @InjectModel(ComparisonResult.name)
    private readonly comparisonModel: Model<ComparisonResultDocument>,
  ) {}

  /** Creates or replaces the comparison for a call (idempotent across retries). */
  upsert(data: {
    callId: string;
    companyId: string;
    comparisonStatus: ComparisonStatus;
    alignmentScore?: number;
    findings?: ComparisonFinding[];
    rawLlmOutput?: string;
  }): Promise<ComparisonResultDocument | null> {
    return this.comparisonModel
      .findOneAndUpdate({ callId: data.callId }, data, {
        new: true,
        upsert: true,
      })
      .exec();
  }

  findByCallId(
    callId: string,
    companyId: string,
  ): Promise<ComparisonResultDocument | null> {
    return this.comparisonModel.findOne({ callId, companyId }).exec();
  }
}
