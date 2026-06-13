import type {
  CallStatus,
  AnalysisStatus,
  ComparisonStatus,
  ComparisonFinding,
  PaginationMeta,
} from '@verity/shared';
import { apiClient, ApiRequestError } from './client';

export interface Call {
  _id: string;
  companyId: string;
  repId: string;
  /** Present on list responses (joined server-side). */
  repName?: string;
  transcriptUrl: string;
  status: CallStatus;
  failureReason?: string;
  /** Present on list responses; null until analysis succeeds. */
  score?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CallAnalysis {
  callId: string;
  analysisStatus: AnalysisStatus;
  parsedOutput?: Record<string, unknown>;
  score?: number;
  rawLlmOutput?: string;
}

export interface ComparisonResult {
  callId: string;
  comparisonStatus: ComparisonStatus;
  alignmentScore?: number;
  findings: ComparisonFinding[];
  rawLlmOutput?: string;
}

/** Returns null on 404 so callers can show a "not ready" state. */
async function getOrNull<T>(url: string): Promise<T | null> {
  try {
    const res = await apiClient.get<{ data: T }>(url);
    return res.data.data;
  } catch (err) {
    if (err instanceof ApiRequestError && err.status === 404) return null;
    throw err;
  }
}

export async function createCall(
  repId: string,
  transcriptText: string,
): Promise<Call> {
  const res = await apiClient.post<{ data: Call }>('/calls', {
    repId,
    transcriptText,
  });
  return res.data.data;
}

export async function listCalls(
  page = 1,
  limit = 20,
): Promise<{ data: Call[]; meta: PaginationMeta }> {
  const res = await apiClient.get<{ data: Call[]; meta: PaginationMeta }>(
    `/calls?page=${page}&limit=${limit}`,
  );
  return { data: res.data.data, meta: res.data.meta };
}

export async function getCall(id: string): Promise<Call> {
  const res = await apiClient.get<{ data: Call }>(`/calls/${id}`);
  return res.data.data;
}

/** Re-enqueues LLM analysis for a call. Returns the call (now back in `queued`). */
export async function retryAnalysis(id: string): Promise<Call> {
  const res = await apiClient.post<{ data: Call }>(
    `/calls/${id}/analysis/retry`,
  );
  return res.data.data;
}

export function getAnalysis(id: string): Promise<CallAnalysis | null> {
  return getOrNull<CallAnalysis>(`/calls/${id}/analysis`);
}

export function getComparison(id: string): Promise<ComparisonResult | null> {
  return getOrNull<ComparisonResult>(`/calls/${id}/comparison`);
}
