import type { Address, LoginResponse, TurfSnapshot, VisitSubmission } from '../types';

const baseUrl = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '');

class ApiError extends Error {
  status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}, token?: string | null) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new ApiError(payload?.message || `Request failed (${response.status})`, response.status);
  }

  return payload as T;
}

export const api = {
  login(email: string, password: string) {
    return request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  me(token: string) {
    return request<LoginResponse['user']>('/me', {}, token);
  },

  myTurf(token: string) {
    return request<TurfSnapshot>('/my-turf', {}, token);
  },

  getAddresses(token: string, turfId: string) {
    return request<{ addresses: Address[] }>(`/turfs/${turfId}/addresses`, {}, token);
  },

  startTurf(
    token: string,
    payload: { turfId: string; latitude?: number | null; longitude?: number | null }
  ) {
    return request('/turf/start', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token);
  },

  endTurf(
    token: string,
    payload: { turfId: string; latitude?: number | null; longitude?: number | null }
  ) {
    return request('/turf/end', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token);
  },

  logVisit(token: string, payload: VisitSubmission) {
    return request('/visits/log', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token);
  },
};

export function getApiBaseUrl() {
  return baseUrl;
}

export function isApiError(error: unknown) {
  return error instanceof ApiError;
}

export function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Something went wrong';
}
