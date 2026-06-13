import { apiClient } from './client';

interface AuthResponse {
  success: boolean;
  data: { accessToken: string };
}

export interface SignupPayload {
  companyName: string;
  companySlug: string;
  name: string;
  email: string;
  password: string;
}

export async function login(
  email: string,
  password: string,
): Promise<string> {
  const res = await apiClient.post<AuthResponse>('/auth/login', {
    email,
    password,
  });
  return res.data.data.accessToken;
}

export async function signup(payload: SignupPayload): Promise<string> {
  const res = await apiClient.post<AuthResponse>('/auth/signup', payload);
  return res.data.data.accessToken;
}
