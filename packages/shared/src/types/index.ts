export type UserRole = 'super_admin' | 'company_admin' | 'manager' | 'rep';

export type CallStatus =
  | 'uploaded'
  | 'queued'
  | 'analyzing'
  | 'analyzed'
  | 'form_pending'
  | 'comparing'
  | 'complete'
  | 'failed';

export type AnalysisStatus = 'success' | 'validation_failed' | 'llm_error';

export type ExtractionStatus =
  | 'pending'
  | 'success'
  | 'validation_failed'
  | 'llm_error';

export type ComparisonStatus = 'success' | 'validation_failed' | 'llm_error';

export type ComparisonFindingStatus = 'match' | 'mismatch' | 'partial';

export interface ComparisonFinding {
  field: string;
  repValue: unknown;
  transcriptValue: unknown;
  status: ComparisonFindingStatus;
  note?: string;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export interface JwtPayload {
  sub: string;
  companyId: string;
  role: UserRole;
  email: string;
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

/** Headline numbers for the dashboard overview cards. */
export interface AnalyticsOverview {
  totalCalls: number;
  analyzedCalls: number;
  avgScore: number | null;
  /** % of analyzed calls with zero compliance issues. */
  complianceRate: number | null;
  avgAlignment: number | null;
  /** avgScore minus the previous equivalent period's avgScore. */
  scoreDelta: number | null;
}

export type TrendUnit = 'week' | 'month';

export interface ScoreTrendPoint {
  /** ISO date string for the start of the bucket. */
  period: string;
  avgScore: number;
  calls: number;
}

export interface ScoreTrend {
  unit: TrendUnit;
  points: ScoreTrendPoint[];
}

export interface LeaderboardRow {
  repId: string;
  repName: string;
  calls: number;
  analyzed: number;
  avgScore: number | null;
  avgAlignment: number | null;
  complianceRate: number | null;
  /** Avg score over the last 7 days minus the 7 days before. */
  trendDelta: number | null;
}

export interface IssueCount {
  value: string;
  count: number;
}

export interface TopIssues {
  goodPoints: IssueCount[];
  improvementPoints: IssueCount[];
  redFlags: IssueCount[];
}

export interface ScoreBucket {
  /** Inclusive lower bound, e.g. 40 for the 40–49 bucket. */
  from: number;
  count: number;
}

export interface ComplianceSummary {
  passed: number;
  failed: number;
  topIssues: IssueCount[];
}

export interface ScatterPoint {
  callId: string;
  repName: string;
  score: number;
  alignment: number;
  /** ISO date string of the call. */
  date: string;
}

export interface RadarDimension {
  label: string;
  /** Normalized 0–100. */
  value: number;
}

export interface RepRadar {
  repId: string;
  repName: string;
  dimensions: RadarDimension[];
}

// ---------------------------------------------------------------------------
// Objection intelligence
// ---------------------------------------------------------------------------

/** How the rep handled an objection raised by the prospect. */
export type ObjectionHandling =
  | 'successful'
  | 'partial'
  | 'unsuccessful'
  | 'ignored';

/** One objection extracted from a call transcript by the analysis LLM. */
export interface ObjectionEntry {
  /** snake_case label, e.g. "pricing", "brand_recognition". */
  type: string;
  repHandling: ObjectionHandling;
  /** 1-2 sentence summary of how the rep responded. */
  repResponseSummary: string;
  /** Verbatim 2-3 lines from the transcript. */
  transcriptExcerpt: string;
}

/**
 * priority — frequent (>25% of calls) and badly handled (<50% success).
 * strong   — success rate >= 70%.
 * watch    — everything else.
 */
export type ObjectionStatus = 'priority' | 'watch' | 'strong';

export type ObjectionSortBy = 'count' | 'successRate' | 'priority';

/** One row in the objection intelligence list. */
export interface ObjectionListItem {
  type: string;
  totalOccurrences: number;
  successfulCount: number;
  partialCount: number;
  unsuccessfulCount: number;
  ignoredCount: number;
  /** % of occurrences handled successfully (0-100). */
  successRate: number;
  /** % of analyzed calls in the period where this objection appeared (0-100). */
  frequencyPct: number;
  status: ObjectionStatus;
}

export interface ObjectionList {
  items: ObjectionListItem[];
  /** Total analyzed calls in the period, for context. */
  totalCallsAnalyzed: number;
}

/** A winning or losing pattern synthesized from call samples. */
export interface ResolutionPattern {
  pattern: string;
  description: string;
}

export interface PlaybookContent {
  do: string[];
  dont: string[];
  suggestedScript: string;
}

/** LLM-synthesized resolution path for one objection type. */
export interface ObjectionResolutionPath {
  objectionType: string;
  winningPatterns: ResolutionPattern[];
  losingPatterns: ResolutionPattern[];
  playbook: PlaybookContent;
  sampleCounts: { successful: number; unsuccessful: number };
  /** ISO timestamp of when this path was generated. */
  lastUpdated: string;
  cached: boolean;
}

/** Returned when there are not enough samples to synthesize a path. */
export interface ObjectionResolutionInsufficient {
  insufficientData: true;
  successfulCount: number;
  unsuccessfulCount: number;
}

