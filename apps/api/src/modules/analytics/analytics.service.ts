import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AnalyticsOverview,
  ComplianceSummary,
  LeaderboardRow,
  RepRadar,
  ScatterPoint,
  ScoreBucket,
  ScoreTrend,
  TopIssues,
  TrendUnit,
} from '@verity/shared';
import { AnalyticsRepository, AnalyticsScope } from './analytics.repository';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

const DAY_MS = 86_400_000;
const DEFAULT_RANGE_DAYS = 30;

const round1 = (n: number | null): number | null =>
  n === null || n === undefined ? null : Math.round(n * 10) / 10;

const clamp100 = (n: number): number => Math.max(0, Math.min(100, n));

@Injectable()
export class AnalyticsService {
  constructor(private readonly analyticsRepo: AnalyticsRepository) {}

  /** Resolves query params into a concrete scope (defaults: last 30 days). */
  private scope(companyId: string, query: AnalyticsQueryDto): AnalyticsScope {
    const to = query.to ?? new Date();
    const from =
      query.from ?? new Date(to.getTime() - DEFAULT_RANGE_DAYS * DAY_MS);
    return { companyId, from, to, repId: query.repId };
  }

  /** Overview cards, with score delta vs the previous equivalent period. */
  async overview(
    companyId: string,
    query: AnalyticsQueryDto,
  ): Promise<AnalyticsOverview> {
    const scope = this.scope(companyId, query);
    const duration = scope.to.getTime() - scope.from.getTime();
    const prevScope: AnalyticsScope = {
      ...scope,
      from: new Date(scope.from.getTime() - duration),
      to: scope.from,
    };

    const [current, previous] = await Promise.all([
      this.analyticsRepo.overview(scope),
      this.analyticsRepo.overview(prevScope),
    ]);

    return {
      totalCalls: current.totalCalls,
      analyzedCalls: current.analyzedCalls,
      avgScore: round1(current.avgScore),
      complianceRate:
        current.analyzedCalls > 0
          ? Math.round(
              (current.compliancePassed / current.analyzedCalls) * 100,
            )
          : null,
      avgAlignment: round1(current.avgAlignment),
      scoreDelta:
        current.avgScore !== null && previous.avgScore !== null
          ? round1(current.avgScore - previous.avgScore)
          : null,
    };
  }

  /** Weekly buckets under 90 days, monthly above. */
  async scoreTrend(
    companyId: string,
    query: AnalyticsQueryDto,
  ): Promise<ScoreTrend> {
    const scope = this.scope(companyId, query);
    const rangeDays = (scope.to.getTime() - scope.from.getTime()) / DAY_MS;
    const unit: TrendUnit = rangeDays < 90 ? 'week' : 'month';
    const rows = await this.analyticsRepo.scoreTrend(scope, unit);
    return {
      unit,
      points: rows.map((r) => ({
        period: r.period.toISOString(),
        avgScore: r.avgScore,
        calls: r.calls,
      })),
    };
  }

  leaderboard(
    companyId: string,
    query: AnalyticsQueryDto,
  ): Promise<LeaderboardRow[]> {
    return this.analyticsRepo.leaderboard(this.scope(companyId, query));
  }

  topIssues(companyId: string, query: AnalyticsQueryDto): Promise<TopIssues> {
    return this.analyticsRepo.topIssues(this.scope(companyId, query));
  }

  /** All ten buckets, zero-filled so the histogram never has holes. */
  async scoreDistribution(
    companyId: string,
    query: AnalyticsQueryDto,
  ): Promise<ScoreBucket[]> {
    const rows = await this.analyticsRepo.scoreDistribution(
      this.scope(companyId, query),
    );
    const byFrom = new Map(rows.map((r) => [r.from, r.count]));
    return Array.from({ length: 10 }, (_, i) => ({
      from: i * 10,
      count: byFrom.get(i * 10) ?? 0,
    }));
  }

  compliance(
    companyId: string,
    query: AnalyticsQueryDto,
  ): Promise<ComplianceSummary> {
    return this.analyticsRepo.compliance(this.scope(companyId, query));
  }

  async alignmentScatter(
    companyId: string,
    query: AnalyticsQueryDto,
  ): Promise<ScatterPoint[]> {
    const rows = await this.analyticsRepo.alignmentScatter(
      this.scope(companyId, query),
    );
    return rows.map((r) => ({ ...r, date: r.date.toISOString() }));
  }

  /**
   * Five normalized 0–100 dimensions for one rep. Volume is relative to the
   * busiest rep in the same scope; trend maps a ±50 point score change onto
   * 0–100 with 50 meaning flat.
   */
  async repRadar(
    companyId: string,
    repId: string,
    query: AnalyticsQueryDto,
  ): Promise<RepRadar> {
    const teamScope = this.scope(companyId, { ...query, repId: undefined });
    const rows = await this.analyticsRepo.leaderboard(teamScope);
    const rep = rows.find((r) => r.repId === repId);
    if (!rep) {
      throw new NotFoundException(
        `No analytics for rep ${repId} in this period`,
      );
    }
    const maxCalls = Math.max(...rows.map((r) => r.calls), 1);

    return {
      repId,
      repName: rep.repName,
      dimensions: [
        { label: 'Score', value: Math.round(rep.avgScore ?? 0) },
        { label: 'Compliance', value: Math.round(rep.complianceRate ?? 0) },
        { label: 'Alignment', value: Math.round(rep.avgAlignment ?? 0) },
        {
          label: 'Volume',
          value: Math.round((rep.calls / maxCalls) * 100),
        },
        {
          label: 'Trend',
          value: Math.round(clamp100(50 + (rep.trendDelta ?? 0))),
        },
      ],
    };
  }
}
