import type { UserRole } from '@verity/shared';
import { apiClient } from './client';

export interface User {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
}

export async function listUsers(): Promise<User[]> {
  const res = await apiClient.get<{ data: User[] }>('/users?limit=100');
  return res.data.data;
}

export interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
  role: 'manager' | 'rep';
}

export async function createUser(payload: CreateUserPayload): Promise<User> {
  const res = await apiClient.post<{ data: User }>('/users', payload);
  return res.data.data;
}

export async function deactivateUser(id: string): Promise<void> {
  await apiClient.delete(`/users/${id}`);
}
