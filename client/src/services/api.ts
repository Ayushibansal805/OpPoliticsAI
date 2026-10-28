import type { DashboardActivity, DashboardSummary, ModelInfo, ModelMetadata, PaginatedPredictions, Prediction, ThemePreference, User } from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000/api/v1').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string, public details?: unknown) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) throw new ApiError(body.message ?? 'Request failed.', response.status, body.code, body.details);
  return body.data as T;
}

export const api = {
  auth: {
    me: () => request<{ user: User }>('/auth/me'),
    login: (payload: { email: string; password: string; remember: boolean }) => request<{ user: User }>('/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
    signup: (payload: { name: string; email: string; password: string; termsAccepted: boolean }) => request<{ user: User }>('/auth/signup', { method: 'POST', body: JSON.stringify(payload) }),
    logout: () => request<null>('/auth/logout', { method: 'POST' }),
  },
  users: {
    updateProfile: (name: string) => request<{ user: User }>('/users/me', { method: 'PATCH', body: JSON.stringify({ name }) }),
    updatePreferences: (themePreference: ThemePreference) => request<{ user: User }>('/users/me/preferences', { method: 'PATCH', body: JSON.stringify({ themePreference }) }),
  },
  dashboard: {
    summary: () => request<DashboardSummary>('/dashboard/summary'),
    activity: () => request<DashboardActivity>('/dashboard/activity'),
  },
  models: {
    list: () => request<{ models: ModelInfo[] }>('/models'),
    metadata: () => request<ModelMetadata>('/models/resolution-time/metadata'),
  },
  predictions: {
    createResolution: (payload: { issue_created: string; issue_priority: string; issue_type: string; issue_proj: string }) => request<{ prediction: Prediction; duration: number; unit: string; predictionType: string; modelId: string; modelVersion?: string }>('/predictions/resolution-time', { method: 'POST', body: JSON.stringify(payload) }),
    list: (page = 1, pageSize = 20, modelId?: string) => request<PaginatedPredictions>(`/predictions?page=${page}&pageSize=${pageSize}${modelId ? `&modelId=${encodeURIComponent(modelId)}` : ''}`),
    detail: (id: string) => request<{ prediction: Prediction }>(`/predictions/${id}`),
    remove: (id: string) => request<null>(`/predictions/${id}`, { method: 'DELETE' }),
  },
};
