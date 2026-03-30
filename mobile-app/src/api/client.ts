import type {
  Address,
  AddressRequestRecord,
  LoginResponse,
  OutcomeDefinition,
  RecentVisitRecord,
  TurfSnapshot,
  VisitSubmission
} from '../types';

const baseUrl = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '');

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status = 0, payload: unknown = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
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
    const message =
      typeof payload?.message === 'string'
        ? payload.message
        : typeof payload?.message?.message === 'string'
          ? payload.message.message
          : typeof payload?.error === 'string'
            ? payload.error
            : `Request failed (${response.status})`;
    throw new ApiError(message, response.status, payload);
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

  listOutcomes(token: string) {
    return request<OutcomeDefinition[]>('/visits/outcomes', {}, token);
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

  pauseTurf(
    token: string,
    payload: { turfId: string; latitude?: number | null; longitude?: number | null }
  ) {
    return request('/turf/pause', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token);
  },

  resumeTurf(
    token: string,
    payload: { turfId: string; latitude?: number | null; longitude?: number | null }
  ) {
    return request('/turf/resume', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token);
  },

  completeTurf(
    token: string,
    payload: { turfId: string; latitude?: number | null; longitude?: number | null }
  ) {
    return request('/turf/complete', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token);
  },

  endTurf(
    token: string,
    payload: { turfId: string; latitude?: number | null; longitude?: number | null }
  ) {
    return request('/turf/complete', {
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

  listRecentVisits(token: string, payload?: { addressId?: string }) {
    const params = new URLSearchParams();
    if (payload?.addressId) {
      params.set('addressId', payload.addressId);
    }
    return request<RecentVisitRecord[]>(
      `/visits/recent${params.toString() ? `?${params.toString()}` : ''}`,
      {},
      token
    );
  },

  correctVisit(
    token: string,
    visitId: string,
    payload: { outcomeCode: string; notes?: string; reason: string }
  ) {
    return request<RecentVisitRecord>(`/visits/${visitId}/correct`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }, token);
  },

  submitAddressRequest(
    token: string,
    payload: {
      turfId: string;
      addressLine1: string;
      city: string;
      state: string;
      zip?: string;
      latitude?: number | null;
      longitude?: number | null;
      notes?: string;
    }
  ) {
    return request<AddressRequestRecord>('/address-requests', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token);
  },

  myAddressRequests(token: string) {
    return request<AddressRequestRecord[]>('/address-requests/mine', {}, token);
  },
};

export function getApiBaseUrl() {
  return baseUrl;
}

export function isApiError(error: unknown) {
  return error instanceof ApiError;
}

export function getSyncStatusForError(error: unknown) {
  if (isApiError(error) && error.status === 409) {
    return 'conflict' as const;
  }

  return 'failed' as const;
}

export function getConflictReason(error: unknown) {
  if (!(error instanceof ApiError) || error.status !== 409) {
    return null;
  }

  const payload = error.payload as
    | {
        message?: { syncConflictReason?: string | null } | string;
        syncConflictReason?: string | null;
      }
    | null;

  if (typeof payload?.syncConflictReason === 'string' && payload.syncConflictReason.trim()) {
    return payload.syncConflictReason;
  }

  if (
    payload?.message &&
    typeof payload.message === 'object' &&
    typeof payload.message.syncConflictReason === 'string' &&
    payload.message.syncConflictReason.trim()
  ) {
    return payload.message.syncConflictReason;
  }

  return 'conflict';
}

export function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Something went wrong';
}
