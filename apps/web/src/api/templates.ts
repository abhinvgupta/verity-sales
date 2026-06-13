import { apiClient, ApiRequestError } from './client';

export interface EvaluationTemplate {
  _id: string;
  companyId: string;
  isActive: boolean;
  callAnalysisPrompt: string;
  outputSchema: Record<string, unknown>;
  formSchema?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplatePayload {
  callAnalysisPrompt: string;
  outputSchema: Record<string, unknown>;
  formSchema?: Record<string, unknown>;
}

export async function getActiveTemplate(): Promise<EvaluationTemplate | null> {
  try {
    const res = await apiClient.get<{ data: EvaluationTemplate }>(
      '/templates/active',
    );
    return res.data.data;
  } catch (err) {
    if (err instanceof ApiRequestError && err.status === 404) return null;
    throw err;
  }
}

export async function createTemplate(
  payload: CreateTemplatePayload,
): Promise<EvaluationTemplate> {
  const res = await apiClient.post<{ data: EvaluationTemplate }>(
    '/templates',
    payload,
  );
  return res.data.data;
}

export async function activateTemplate(
  id: string,
): Promise<EvaluationTemplate> {
  const res = await apiClient.patch<{ data: EvaluationTemplate }>(
    `/templates/${id}/activate`,
    {},
  );
  return res.data.data;
}
