import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { FilterQuery, Model, UpdateQuery } from "mongoose";
import { CallStatus, PaginationMeta } from "@verity/shared";
import { Call, CallDocument } from "../../database/schemas";
import { ListCallsDto } from "./dto/list-calls.dto";

/** List row shape: a call enriched with its analysis score and rep name. */
export interface CallListItem {
  _id: string;
  companyId: string;
  repId: string;
  repName: string;
  transcriptUrl: string;
  status: CallStatus;
  failureReason?: string;
  score: number | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class CallsRepository {
  constructor(
    @InjectModel(Call.name) private readonly callModel: Model<CallDocument>
  ) {}

  create(data: {
    _id: string;
    companyId: string;
    repId: string;
    transcriptUrl: string;
    status: CallStatus;
  }): Promise<CallDocument> {
    return this.callModel.create(data);
  }

  async findAll(
    companyId: string,
    query: ListCallsDto
  ): Promise<{ data: CallListItem[]; meta: PaginationMeta }> {
    const filter: FilterQuery<CallDocument> = { companyId };
    if (query.repId) filter.repId = query.repId;
    if (query.status) filter.status = query.status;
    if (query.from || query.to) {
      filter.createdAt = {};
      if (query.from) filter.createdAt.$gte = query.from;
      if (query.to) filter.createdAt.$lte = query.to;
    }

    const { page, limit } = query;
    const [data, total] = await Promise.all([
      // Joins run after the page slice, so only `limit` calls are enriched.
      this.callModel.aggregate<CallListItem>([
        { $match: filter },
        { $sort: { createdAt: -1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit },
        {
          $lookup: {
            from: "callanalyses",
            localField: "_id",
            foreignField: "callId",
            as: "analysis",
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "repId",
            foreignField: "_id",
            as: "rep",
          },
        },
        {
          $addFields: {
            repName: {
              $ifNull: [{ $arrayElemAt: ["$rep.name", 0] }, "Unknown rep"],
            },
            score: {
              $cond: [
                {
                  $eq: [
                    { $arrayElemAt: ["$analysis.analysisStatus", 0] },
                    "success",
                  ],
                },
                { $ifNull: [{ $arrayElemAt: ["$analysis.score", 0] }, null] },
                null,
              ],
            },
          },
        },
        { $project: { analysis: 0, rep: 0 } },
      ]),
      this.callModel.countDocuments(filter),
    ]);
    return { data, meta: { page, limit, total } };
  }

  findById(id: string, companyId: string): Promise<CallDocument | null> {
    return this.callModel.findOne({ _id: id, companyId }).exec();
  }

  updateStatus(
    id: string,
    companyId: string,
    status: CallStatus,
    failureReason?: string
  ): Promise<CallDocument | null> {
    const update: UpdateQuery<CallDocument> = { $set: { status } };
    if (status === "failed") {
      if (failureReason !== undefined)
        update.$set.failureReason = failureReason;
    } else {
      // Leaving a failed state — drop any stale failure reason.
      update.$unset = { failureReason: "" };
    }
    return this.callModel
      .findOneAndUpdate({ _id: id, companyId }, update, { new: true })
      .exec();
  }
}
