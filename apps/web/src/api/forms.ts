import type { ExtractionStatus } from '@verity/shared';
import { apiClient, ApiRequestError } from './client';

export interface RepForm {
  callId: string;
  formImageUrl: string;
  extractionStatus: ExtractionStatus;
  datapoints?: Record<string, unknown>;
  rawLlmOutput?: string;
  submittedAt: string;
}

export async function getForm(callId: string): Promise<RepForm | null> {
  try {
    const res = await apiClient.get<{ data: RepForm }>(`/calls/${callId}/form`);
    return res.data.data;
  } catch (err) {
    if (err instanceof ApiRequestError && err.status === 404) return null;
    throw err;
  }
}

export async function uploadForm(callId: string, file: File): Promise<RepForm> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await apiClient.post<{ data: RepForm }>(
    `/calls/${callId}/form`,
    formData,
  );
  return res.data.data;
}
