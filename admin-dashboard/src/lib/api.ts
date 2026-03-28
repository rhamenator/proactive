import type {
  CanvasserRecord,
  DashboardSummary,
  LoginResponse,
  SafeUser,
  TurfAddressImportResult,
  TurfListItem
} from './types';

const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '');

export class ApiError extends Error {
  status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function normalizeErrorMessage(payload: unknown, fallback: string) {
  if (!payload) {
    return fallback;
  }
  if (typeof payload === 'string') {
    return payload;
  }
  if (Array.isArray(payload)) {
    return payload.join(', ');
  }
  if (typeof payload === 'object' && payload && 'message' in payload) {
    const message = (payload as { message?: unknown }).message;
    if (Array.isArray(message)) {
      return message.join(', ');
    }
    if (typeof message === 'string') {
      return message;
    }
  }
  return fallback;
}

async function requestJson<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null
): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let payload: unknown = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    throw new ApiError(
      normalizeErrorMessage(payload, `Request failed (${response.status})`),
      response.status
    );
  }

  return payload as T;
}

async function requestBlob(path: string, token?: string | null) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });

  if (!response.ok) {
    const text = await response.text();
    let payload: unknown = text;
    try {
      payload = JSON.parse(text);
    } catch {
      // leave as text
    }
    throw new ApiError(
      normalizeErrorMessage(payload, `Request failed (${response.status})`),
      response.status
    );
  }

  const blob = await response.blob();
  return {
    blob,
    filename:
      response.headers
        .get('content-disposition')
        ?.match(/filename="?([^"]+)"?/)?.[1] ?? 'van-results.csv'
  };
}

export function createApiClient(token?: string | null) {
  return {
    login(email: string, password: string) {
      return requestJson<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
    },
    me() {
      return requestJson<SafeUser>('/me', {}, token);
    },
    dashboardSummary() {
      return requestJson<DashboardSummary>('/admin/dashboard-summary', {}, token);
    },
    activeCanvassers() {
      return requestJson<DashboardSummary['activeCanvassers']>('/admin/active-canvassers', {}, token);
    },
    listCanvassers() {
      return requestJson<CanvasserRecord[]>('/admin/canvassers', {}, token);
    },
    createCanvasser(payload: {
      firstName: string;
      lastName: string;
      email: string;
      password: string;
    }) {
      return requestJson<CanvasserRecord>('/admin/canvassers', {
        method: 'POST',
        body: JSON.stringify(payload)
      }, token);
    },
    updateCanvasser(
      id: string,
      payload: Partial<{
        firstName: string;
        lastName: string;
        email: string;
        password: string;
        isActive: boolean;
      }>
    ) {
      return requestJson<CanvasserRecord>(`/admin/canvassers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      }, token);
    },
    listTurfs() {
      return requestJson<TurfListItem[]>('/turfs', {}, token);
    },
    createTurf(payload: { name: string; description?: string }) {
      return requestJson<TurfListItem>('/turfs', {
        method: 'POST',
        body: JSON.stringify(payload)
      }, token);
    },
    assignTurf(turfId: string, canvasserId: string) {
      return requestJson(`/admin/turfs/${turfId}/reassign`, {
        method: 'POST',
        body: JSON.stringify({ canvasserId })
      }, token);
    },
    reassignTurf(turfId: string, canvasserId: string) {
      return requestJson(`/admin/turfs/${turfId}/reassign`, {
        method: 'POST',
        body: JSON.stringify({ canvasserId })
      }, token);
    },
    reopenTurf(turfId: string) {
      return requestJson(`/admin/turfs/${turfId}/reopen`, {
        method: 'POST'
      }, token);
    },
    importTurfs(payload: { file: File; turfName?: string; mapping?: string }) {
      const formData = new FormData();
      formData.append('file', payload.file);
      if (payload.turfName) {
        formData.append('turfName', payload.turfName);
      }
      if (payload.mapping) {
        formData.append('mapping', payload.mapping);
      }
      return requestJson<TurfAddressImportResult>('/turfs/import-csv', {
        method: 'POST',
        body: formData
      }, token);
    },
    exportVanResults(payload?: { turfId?: string; markExported?: boolean }) {
      const params = new URLSearchParams();
      if (payload?.turfId) {
        params.set('turfId', payload.turfId);
      }
      if (payload?.markExported) {
        params.set('markExported', 'true');
      }
      return requestBlob(`/exports/van-results${params.toString() ? `?${params.toString()}` : ''}`, token);
    }
  };
}

export function getBaseUrl() {
  return baseUrl;
}

export function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Something went wrong';
}
