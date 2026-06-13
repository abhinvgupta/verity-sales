import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AnalysisStatus, ObjectionEntry } from '@verity/shared';
import { CallAnalysis, CallAnalysisDocument } from '../../database/schemas';

@Injectable()
export class AnalysisRepository {
  constructor(
    @InjectModel(CallAnalysis.name)
    private readonly analysisModel: Model<CallAnalysisDocument>,
  ) {}

  /** Creates or replaces the analysis for a call (idempotent across retries). */
  upsert(data: {
    callId: string;
    companyId: string;
    rawLlmOutput?: string;
    parsedOutput?: Record<string, unknown>;
    score?: number;
    objections?: ObjectionEntry[];
    analysisStatus: AnalysisStatus;
  }): Promise<CallAnalysisDocument | null> {
    return this.analysisModel
      .findOneAndUpdate({ callId: data.callId }, data, {
        new: true,
        upsert: true,
      })
      .exec();
  }

  findByCallId(
    callId: string,
    companyId: string,
  ): Promise<CallAnalysisDocument | null> {
    return this.analysisModel.findOne({ callId, companyId }).exec();
  }
}
