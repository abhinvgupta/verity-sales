import type {
  AnalyticsOverview,
  ComplianceSummary,
  LeaderboardRow,
  RepRadar,
  ScatterPoint,
  ScoreBucket,
  ScoreTrend,
  TopIssues,
} from '@verity/shared';
import { apiClient } from './client';

export interface AnalyticsQuery {
  from: string;
  to: string;
  repId?: string;
}

function toParams(query: AnalyticsQuery): string {
  const params = new URLSearchParams({ from: query.from, to: query.to });
  if (query.repId) params.set('repId', query.repId);
  return params.toString();
}

async function get<T>(path: string, query: AnalyticsQuery): Promise<T> {
  const res = await apiClient.get<{ data: T }>(
    `/analytics/${path}?${toParams(query)}`,
  );
  return res.data.data;
}

export const getOverview = (q: AnalyticsQuery) =>
  get<AnalyticsOverview>('overview', q);

export const getScoreTrend = (q: AnalyticsQuery) =>
  get<ScoreTrend>('score-trend', q);

export const getLeaderboard = (q: AnalyticsQuery) =>
  get<LeaderboardRow[]>('leaderboard', q);

export const getTopIssues = (q: AnalyticsQuery) =>
  get<TopIssues>('top-issues', q);

export const getScoreDistribution = (q: AnalyticsQuery) =>
  get<ScoreBucket[]>('score-distribution', q);

export const getCompliance = (q: AnalyticsQuery) =>
  get<ComplianceSummary>('compliance', q);

export const getAlignmentScatter = (q: AnalyticsQuery) =>
  get<ScatterPoint[]>('alignment-scatter', q);

export const getRepRadar = (repId: string, q: AnalyticsQuery) =>
  get<RepRadar>(`rep-radar/${repId}`, q);
