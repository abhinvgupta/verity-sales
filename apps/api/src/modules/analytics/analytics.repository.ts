import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage } from 'mongoose';
import {
  IssueCount,
  ObjectionList,
  ObjectionSortBy,
  TrendUnit,
} from '@verity/shared';
import {
  Call,
  CallAnalysis,
  CallAnalysisDocument,
  CallDocument,
  LlmDebugLog,
  LlmDebugLogDocument,
} from '../../database/schemas';

/**
 * Fully-resolved analytics scope. Every aggregation starts from `calls` so the
 * initial $match is covered by the { companyId, createdAt } index; analyses,
 * comparisons and users are joined via $lookup on their unique/_id indexes.
 */
export interface AnalyticsScope {
  companyId: string;
  from: Date;
  to: Date;
  repId?: string;
}

/**
 * Aggregations read the default template's parsedOutput shape
 * (whatWentWell[].point, areasForImprovement[].point, redFlags[].issue,
 * complianceIssues[]). Tenants with custom output schemas simply produce
 * empty issue lists — counts are exact-string for now (no taxonomy yet).
 */
const SUCCESS = { $eq: ['$analysis.analysisStatus', 'success'] };
const COMPARED = { $eq: ['$comparison.comparisonStatus', 'success'] };
const NO_COMPLIANCE_ISSUES = {
  $eq: [
    { $size: { $ifNull: ['$analysis.parsedOutput.complianceIssues', []] } },
    0,
  ],
};

export interface OverviewRow {
  totalCalls: number;
  analyzedCalls: number;
  avgScore: number | null;
  compliancePassed: number;
  avgAlignment: number | null;
}

export interface LeaderboardAggRow {
  repId: string;
  repName: string;
  calls: number;
  analyzed: number;
  avgScore: number | null;
  avgAlignment: number | null;
  complianceRate: number | null;
  trendDelta: number | null;
}

/** One transcript sample fed to the resolution-path synthesis prompt. */
export interface ObjectionSample {
  repHandling: string;
  repResponseSummary: string;
  transcriptExcerpt: string;
  score?: number;
}

export interface ObjectionSampleBuckets {
  successful: ObjectionSample[];
  unsuccessful: ObjectionSample[];
}

@Injectable()
export class AnalyticsRepository {
  constructor(
    @InjectModel(Call.name) private readonly callModel: Model<CallDocument>,
    @InjectModel(CallAnalysis.name)
    private readonly analysisModel: Model<CallAnalysisDocument>,
    @InjectModel(LlmDebugLog.name)
    private readonly debugLogModel: Model<LlmDebugLogDocument>,
  ) {}

  private scopeMatch(scope: AnalyticsScope): PipelineStage.Match {
    return {
      $match: {
        companyId: scope.companyId,
        createdAt: { $gte: scope.from, $lte: scope.to },
        ...(scope.repId ? { repId: scope.repId } : {}),
      },
    };
  }

  /** $lookup + $unwind of the call's analysis; keeps calls without one. */
  private analysisJoin(): PipelineStage[] {
    return [
      {
        $lookup: {
          from: 'callanalyses',
          localField: '_id',
          foreignField: 'callId',
          as: 'analysis',
        },
      },
      { $unwind: { path: '$analysis', preserveNullAndEmptyArrays: true } },
    ];
  }

  private comparisonJoin(): PipelineStage[] {
    return [
      {
        $lookup: {
          from: 'comparisonresults',
          localField: '_id',
          foreignField: 'callId',
          as: 'comparison',
        },
      },
      { $unwind: { path: '$comparison', preserveNullAndEmptyArrays: true } },
    ];
  }

  /** Calls joined to successful analyses only — base for issue/score charts. */
  private analyzedCallsBase(scope: AnalyticsScope): PipelineStage[] {
    return [
      this.scopeMatch(scope),
      ...this.analysisJoin(),
      { $match: { 'analysis.analysisStatus': 'success' } },
    ];
  }

  async overview(scope: AnalyticsScope): Promise<OverviewRow> {
    const [row] = await this.callModel.aggregate<OverviewRow>([
      this.scopeMatch(scope),
      ...this.analysisJoin(),
      ...this.comparisonJoin(),
      {
        $group: {
          _id: null,
          totalCalls: { $sum: 1 },
          analyzedCalls: { $sum: { $cond: [SUCCESS, 1, 0] } },
          avgScore: { $avg: { $cond: [SUCCESS, '$analysis.score', null] } },
          compliancePassed: {
            $sum: {
              $cond: [{ $and: [SUCCESS, NO_COMPLIANCE_ISSUES] }, 1, 0],
            },
          },
          avgAlignment: {
            $avg: { $cond: [COMPARED, '$comparison.alignmentScore', null] },
          },
        },
      },
      { $project: { _id: 0 } },
    ]);
    return (
      row ?? {
        totalCalls: 0,
        analyzedCalls: 0,
        avgScore: null,
        compliancePassed: 0,
        avgAlignment: null,
      }
    );
  }

  async scoreTrend(
    scope: AnalyticsScope,
    unit: TrendUnit,
  ): Promise<{ period: Date; avgScore: number; calls: number }[]> {
    return this.callModel.aggregate([
      ...this.analyzedCallsBase(scope),
      {
        $group: {
          _id: { $dateTrunc: { date: '$createdAt', unit } },
          avgScore: { $avg: '$analysis.score' },
          calls: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          period: '$_id',
          avgScore: { $round: ['$avgScore', 1] },
          calls: 1,
        },
      },
    ]);
  }

  /**
   * One row per rep. `trendDelta` compares the 7 days up to `to` with the
   * 7 days before that, so the indicator tracks the end of the window.
   */
  async leaderboard(scope: AnalyticsScope): Promise<LeaderboardAggRow[]> {
    const last7 = new Date(scope.to.getTime() - 7 * 86_400_000);
    const prior7 = new Date(scope.to.getTime() - 14 * 86_400_000);
    const inRecent = { $gte: ['$createdAt', last7] };
    const inPrior = {
      $and: [{ $gte: ['$createdAt', prior7] }, { $lt: ['$createdAt', last7] }],
    };

    return this.callModel.aggregate([
      this.scopeMatch(scope),
      ...this.analysisJoin(),
      ...this.comparisonJoin(),
      {
        $group: {
          _id: '$repId',
          calls: { $sum: 1 },
          analyzed: { $sum: { $cond: [SUCCESS, 1, 0] } },
          avgScore: { $avg: { $cond: [SUCCESS, '$analysis.score', null] } },
          avgAlignment: {
            $avg: { $cond: [COMPARED, '$comparison.alignmentScore', null] },
          },
          compliancePassed: {
            $sum: { $cond: [{ $and: [SUCCESS, NO_COMPLIANCE_ISSUES] }, 1, 0] },
          },
          recentScore: {
            $avg: {
              $cond: [{ $and: [SUCCESS, inRecent] }, '$analysis.score', null],
            },
          },
          priorScore: {
            $avg: {
              $cond: [{ $and: [SUCCESS, inPrior] }, '$analysis.score', null],
            },
          },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'rep',
        },
      },
      { $unwind: { path: '$rep', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          repId: '$_id',
          repName: { $ifNull: ['$rep.name', 'Unknown rep'] },
          calls: 1,
          analyzed: 1,
          avgScore: { $round: ['$avgScore', 1] },
          avgAlignment: { $round: ['$avgAlignment', 1] },
          complianceRate: {
            $cond: [
              { $gt: ['$analyzed', 0] },
              {
                $round: [
                  {
                    $multiply: [
                      { $divide: ['$compliancePassed', '$analyzed'] },
                      100,
                    ],
                  },
                  0,
                ],
              },
              null,
            ],
          },
          trendDelta: {
            $cond: [
              {
                $and: [
                  { $ne: ['$recentScore', null] },
                  { $ne: ['$priorScore', null] },
                ],
              },
              { $round: [{ $subtract: ['$recentScore', '$priorScore'] }, 1] },
              null,
            ],
          },
        },
      },
      { $sort: { avgScore: -1, calls: -1 } },
    ]);
  }

  async topIssues(scope: AnalyticsScope): Promise<{
    goodPoints: IssueCount[];
    improvementPoints: IssueCount[];
    redFlags: IssueCount[];
  }> {
    const countFacet = (path: string, field: string, limit: number) => [
      { $unwind: `$analysis.parsedOutput.${path}` },
      { $sortByCount: `$analysis.parsedOutput.${path}.${field}` },
      { $match: { _id: { $type: 'string' } } },
      { $limit: limit },
      { $project: { _id: 0, value: '$_id', count: 1 } },
    ];

    const [row] = await this.callModel.aggregate([
      ...this.analyzedCallsBase(scope),
      {
        $facet: {
          goodPoints: countFacet('whatWentWell', 'point', 10),
          improvementPoints: countFacet('areasForImprovement', 'point', 10),
          redFlags: countFacet('redFlags', 'issue', 10),
        },
      },
    ]);
    return row ?? { goodPoints: [], improvementPoints: [], redFlags: [] };
  }

  /** Counts per 10-point score bucket; 100 lands in the 90+ bucket. */
  async scoreDistribution(
    scope: AnalyticsScope,
  ): Promise<{ from: number; count: number }[]> {
    const boundaries = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 101];
    return this.callModel.aggregate([
      ...this.analyzedCallsBase(scope),
      {
        $bucket: {
          groupBy: '$analysis.score',
          boundaries,
          default: -1,
          output: { count: { $sum: 1 } },
        },
      },
      { $match: { _id: { $gte: 0 } } },
      { $project: { _id: 0, from: '$_id', count: 1 } },
    ]);
  }

  async compliance(scope: AnalyticsScope): Promise<{
    passed: number;
    failed: number;
    topIssues: IssueCount[];
  }> {
    const [row] = await this.callModel.aggregate([
      ...this.analyzedCallsBase(scope),
      {
        $facet: {
          summary: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                passed: { $sum: { $cond: [NO_COMPLIANCE_ISSUES, 1, 0] } },
              },
            },
          ],
          topIssues: [
            { $unwind: '$analysis.parsedOutput.complianceIssues' },
            { $sortByCount: '$analysis.parsedOutput.complianceIssues.issue' },
            { $match: { _id: { $type: 'string' } } },
            { $limit: 5 },
            { $project: { _id: 0, value: '$_id', count: 1 } },
          ],
        },
      },
    ]);
    const summary = row?.summary?.[0] ?? { total: 0, passed: 0 };
    return {
      passed: summary.passed,
      failed: summary.total - summary.passed,
      topIssues: row?.topIssues ?? [],
    };
  }

  /** Latest analyzed+compared calls, capped at 200 points. */
  async alignmentScatter(scope: AnalyticsScope): Promise<
    {
      callId: string;
      repName: string;
      score: number;
      alignment: number;
      date: Date;
    }[]
  > {
    return this.callModel.aggregate([
      ...this.analyzedCallsBase(scope),
      ...this.comparisonJoin(),
      { $match: { 'comparison.comparisonStatus': 'success' } },
      { $sort: { createdAt: -1 } },
      { $limit: 200 },
      {
        $lookup: {
          from: 'users',
          localField: 'repId',
          foreignField: '_id',
          as: 'rep',
        },
      },
      { $unwind: { path: '$rep', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          callId: '$_id',
          repName: { $ifNull: ['$rep.name', 'Unknown rep'] },
          score: '$analysis.score',
          alignment: '$comparison.alignmentScore',
          date: '$createdAt',
        },
      },
    ]);
  }

  /**
   * Objection intelligence list: one row per objection type with handling
   * counts, success rate, frequency vs analyzed calls, and a derived status.
   * Entirely computed in the pipeline; `prioritySort` ranks rows by
   * frequencyPct * (100 - successRate).
   */
  async objectionList(
    scope: AnalyticsScope,
    sortBy: ObjectionSortBy,
    search?: string,
  ): Promise<ObjectionList> {
    const handlingCount = (handling: string) => ({
      $sum: {
        $cond: [
          { $eq: ['$analysis.objections.repHandling', handling] },
          1,
          0,
        ],
      },
    });
    const searchMatch: PipelineStage.FacetPipelineStage[] = search
      ? [
          {
            $match: {
              'analysis.objections.type': {
                // Escape regex metacharacters — search is a plain substring.
                $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
                $options: 'i',
              },
            },
          },
        ]
      : [];
    const sortSpec: Record<string, 1 | -1> =
      sortBy === 'successRate'
        ? { successRate: 1 }
        : sortBy === 'priority'
          ? { prioritySort: -1 }
          : { totalOccurrences: -1 };

    const [row] = await this.callModel.aggregate<ObjectionList>([
      ...this.analyzedCallsBase(scope),
      {
        $facet: {
          totals: [{ $count: 'calls' }],
          byType: [
            { $unwind: '$analysis.objections' },
            ...searchMatch,
            {
              $group: {
                _id: '$analysis.objections.type',
                totalOccurrences: { $sum: 1 },
                successfulCount: handlingCount('successful'),
                partialCount: handlingCount('partial'),
                unsuccessfulCount: handlingCount('unsuccessful'),
                ignoredCount: handlingCount('ignored'),
                // Distinct calls — an objection raised twice in one call
                // counts once toward frequency.
                callIds: { $addToSet: '$_id' },
              },
            },
          ],
        },
      },
      {
        $project: {
          totalCallsAnalyzed: {
            $ifNull: [{ $arrayElemAt: ['$totals.calls', 0] }, 0],
          },
          byType: 1,
        },
      },
      {
        $addFields: {
          items: {
            $map: {
              input: '$byType',
              as: 'o',
              in: {
                type: '$$o._id',
                totalOccurrences: '$$o.totalOccurrences',
                successfulCount: '$$o.successfulCount',
                partialCount: '$$o.partialCount',
                unsuccessfulCount: '$$o.unsuccessfulCount',
                ignoredCount: '$$o.ignoredCount',
                successRate: {
                  $round: [
                    {
                      $multiply: [
                        {
                          $divide: [
                            '$$o.successfulCount',
                            '$$o.totalOccurrences',
                          ],
                        },
                        100,
                      ],
                    },
                    1,
                  ],
                },
                frequencyPct: {
                  $cond: [
                    { $gt: ['$totalCallsAnalyzed', 0] },
                    {
                      $round: [
                        {
                          $multiply: [
                            {
                              $divide: [
                                { $size: '$$o.callIds' },
                                '$totalCallsAnalyzed',
                              ],
                            },
                            100,
                          ],
                        },
                        1,
                      ],
                    },
                    0,
                  ],
                },
              },
            },
          },
        },
      },
      {
        $addFields: {
          items: {
            $map: {
              input: '$items',
              as: 'o',
              in: {
                $mergeObjects: [
                  '$$o',
                  {
                    status: {
                      $switch: {
                        branches: [
                          {
                            case: {
                              $and: [
                                { $gt: ['$$o.frequencyPct', 25] },
                                { $lt: ['$$o.successRate', 50] },
                              ],
                            },
                            then: 'priority',
                          },
                          {
                            case: { $gte: ['$$o.successRate', 70] },
                            then: 'strong',
                          },
                        ],
                        default: 'watch',
                      },
                    },
                    prioritySort: {
                      $multiply: [
                        '$$o.frequencyPct',
                        { $subtract: [100, '$$o.successRate'] },
                      ],
                    },
                  },
                ],
              },
            },
          },
        },
      },
      {
        // Sort, then drop the internal prioritySort ranking field so items
        // match ObjectionListItem exactly.
        $project: {
          _id: 0,
          totalCallsAnalyzed: 1,
          items: {
            $map: {
              input: { $sortArray: { input: '$items', sortBy: sortSpec } },
              as: 'o',
              in: {
                type: '$$o.type',
                totalOccurrences: '$$o.totalOccurrences',
                successfulCount: '$$o.successfulCount',
                partialCount: '$$o.partialCount',
                unsuccessfulCount: '$$o.unsuccessfulCount',
                ignoredCount: '$$o.ignoredCount',
                successRate: '$$o.successRate',
                frequencyPct: '$$o.frequencyPct',
                status: '$$o.status',
              },
            },
          },
        },
      },
    ]);
    return row ?? { totalCallsAnalyzed: 0, items: [] };
  }

  /**
   * Sample buckets for resolution-path synthesis, in one $facet query over
   * all of the company's analyses (no date scope — the playbook draws on the
   * full history). Successful = handled successfully on a high-scoring call;
   * unsuccessful = mishandled/ignored, or partial handling on a low-scoring
   * call (successful handling is never a losing example).
   */
  // INDEX REQUIRED: { companyId: 1, 'objections.type': 1 } on callanalyses
  // covers the initial $match (declared in call-analysis.schema.ts).
  async objectionSamples(
    companyId: string,
    type: string,
    limit = 15,
  ): Promise<ObjectionSampleBuckets> {
    const sampleProject = {
      $project: {
        _id: 0,
        repHandling: '$objections.repHandling',
        repResponseSummary: '$objections.repResponseSummary',
        transcriptExcerpt: '$objections.transcriptExcerpt',
        score: 1,
      },
    };

    const [row] = await this.analysisModel.aggregate<ObjectionSampleBuckets>([
      {
        $match: {
          companyId,
          analysisStatus: 'success',
          'objections.type': type,
        },
      },
      { $unwind: '$objections' },
      { $match: { 'objections.type': type } },
      {
        $facet: {
          successful: [
            {
              $match: {
                'objections.repHandling': 'successful',
                score: { $gte: 75 },
              },
            },
            { $sort: { createdAt: -1 } },
            { $limit: limit },
            sampleProject,
          ],
          unsuccessful: [
            {
              // Mishandled/ignored anywhere, or any non-successful handling
              // on a low-scoring call. Successful handling never counts as a
              // losing example — it would muddy the synthesis prompt.
              $match: {
                'objections.repHandling': { $ne: 'successful' },
                $or: [
                  {
                    'objections.repHandling': {
                      $in: ['unsuccessful', 'ignored'],
                    },
                  },
                  { score: { $lt: 50 } },
                ],
              },
            },
            { $sort: { createdAt: -1 } },
            { $limit: limit },
            sampleProject,
          ],
        },
      },
    ]);
    return row ?? { successful: [], unsuccessful: [] };
  }

  /** Preserves a raw LLM output that failed validation, for debugging. */
  async saveLlmDebugLog(data: {
    companyId: string;
    context: string;
    rawLlmOutput: string;
    validationError?: string;
  }): Promise<void> {
    await this.debugLogModel.create(data);
  }
}
