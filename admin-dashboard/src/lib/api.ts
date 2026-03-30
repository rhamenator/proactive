import type {
  AddressRequestRecord,
  AuditActivityItem,
  AuditActivityReport,
  AuthLoginResponse,
  CampaignRecord,
  DashboardSummary,
  DisableMfaResponse,
  ExportBatchAnalyticsReport,
  ExportBatchRecord,
  FieldUserRecord,
  GpsReviewItem,
  GpsExceptionsReport,
  ImportBatchRecord,
  ImportDuplicateReviewRecord,
  ImpersonationStartResponse,
  LoginResponse,
  RecentVisitRecord,
  ResolvedConflictReport,
  ProductivityRow,
  ProductivityReport,
  ReportFilters,
  ReportOverview,
  RetentionSummary,
  TrendReport,
  MfaSetupInitResponse,
  MfaStatusResponse,
  MfaStepUpResponse,
  OutcomeDefinitionRecord,
  OperationalPolicyRecord,
  SafeUser,
  SyncConflictItem,
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

function buildQueryString(filters?: ReportFilters) {
  if (!filters) {
    return '';
  }

  const params = new URLSearchParams();
  if (filters.dateFrom) {
    params.set('dateFrom', filters.dateFrom);
  }
  if (filters.dateTo) {
    params.set('dateTo', filters.dateTo);
  }
  if (filters.turfId) {
    params.set('turfId', filters.turfId);
  }
  if (filters.canvasserId) {
    params.set('canvasserId', filters.canvasserId);
  }
  if (filters.campaignId) {
    params.set('campaignId', filters.campaignId);
  }
  if (filters.outcomeCode) {
    params.set('outcomeCode', filters.outcomeCode);
  }
  if (filters.syncStatus) {
    params.set('syncStatus', filters.syncStatus);
  }
  if (filters.gpsStatus) {
    params.set('gpsStatus', filters.gpsStatus);
  }
  if (filters.overrideFlag !== undefined) {
    params.set('overrideFlag', String(filters.overrideFlag));
  }

  const query = params.toString();
  return query ? `?${query}` : '';
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
      return requestJson<AuthLoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
    },
    mfaSetupInit(challengeToken: string) {
      return requestJson<MfaSetupInitResponse>('/auth/mfa/setup/init', {
        method: 'POST',
        body: JSON.stringify({ challengeToken })
      });
    },
    mfaSetupComplete(challengeToken: string, code: string) {
      return requestJson<LoginResponse>('/auth/mfa/setup/complete', {
        method: 'POST',
        body: JSON.stringify({ challengeToken, code })
      });
    },
    mfaVerify(challengeToken: string, code: string) {
      return requestJson<LoginResponse>('/auth/mfa/verify', {
        method: 'POST',
        body: JSON.stringify({ challengeToken, code })
      });
    },
    mfaStepUp(code: string) {
      return requestJson<MfaStepUpResponse>('/auth/mfa/step-up', {
        method: 'POST',
        body: JSON.stringify({ code })
      }, token);
    },
    mfaStatus() {
      return requestJson<MfaStatusResponse>('/auth/mfa/status', {}, token);
    },
    disableMfa(password: string, code: string) {
      return requestJson<DisableMfaResponse>('/auth/mfa/disable', {
        method: 'POST',
        body: JSON.stringify({ password, code })
      }, token);
    },
    me() {
      return requestJson<SafeUser>('/me', {}, token);
    },
    dashboardSummary() {
      return requestJson<DashboardSummary>('/admin/dashboard-summary', {}, token);
    },
    reportsOverview(filters?: ReportFilters) {
      return requestJson<ReportOverview>(`/reports/overview${buildQueryString(filters)}`, {}, token);
    },
    reportsProductivity(filters?: ReportFilters) {
      return requestJson<ProductivityReport>(`/reports/productivity${buildQueryString(filters)}`, {}, token);
    },
    reportsGpsExceptions(filters?: ReportFilters) {
      return requestJson<GpsExceptionsReport>(`/reports/gps-exceptions${buildQueryString(filters)}`, {}, token);
    },
    reportsAuditActivity(filters?: ReportFilters) {
      return requestJson<AuditActivityReport>(`/reports/audit-activity${buildQueryString(filters)}`, {}, token);
    },
    reportsTrends(filters?: ReportFilters) {
      return requestJson<TrendReport>(`/reports/trends${buildQueryString(filters)}`, {}, token);
    },
    reportsResolvedConflicts(filters?: ReportFilters) {
      return requestJson<ResolvedConflictReport>(`/reports/resolved-conflicts${buildQueryString(filters)}`, {}, token);
    },
    reportsExportBatches(filters?: ReportFilters) {
      return requestJson<ExportBatchAnalyticsReport>(`/reports/export-batches${buildQueryString(filters)}`, {}, token);
    },
    activeImpersonation() {
      return requestJson<SafeUser['impersonation']>('/auth/impersonation/active', {}, token);
    },
    startImpersonation(targetUserId: string, reason?: string) {
      return requestJson<ImpersonationStartResponse>('/auth/impersonation/start', {
        method: 'POST',
        body: JSON.stringify({ targetUserId, reason })
      }, token);
    },
    stopImpersonation(sessionId: string) {
      return requestJson<{ success: boolean }>('/auth/impersonation/stop', {
        method: 'POST',
        body: JSON.stringify({ sessionId })
      }, token);
    },
    listAddressRequestsForReview(payload?: { status?: AddressRequestRecord['status']; take?: number }) {
      const params = new URLSearchParams();
      if (payload?.status) {
        params.set('status', payload.status);
      }
      if (payload?.take) {
        params.set('take', String(payload.take));
      }
      return requestJson<AddressRequestRecord[]>(`/address-requests/review${params.toString() ? `?${params.toString()}` : ''}`, {}, token);
    },
    approveAddressRequest(id: string, reason?: string) {
      return requestJson<AddressRequestRecord>(`/address-requests/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ reason })
      }, token);
    },
    rejectAddressRequest(id: string, reason: string) {
      return requestJson<AddressRequestRecord>(`/address-requests/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason })
      }, token);
    },
    listRecentVisits(payload?: { turfId?: string; canvasserId?: string; addressId?: string }) {
      const params = new URLSearchParams();
      if (payload?.turfId) {
        params.set('turfId', payload.turfId);
      }
      if (payload?.canvasserId) {
        params.set('canvasserId', payload.canvasserId);
      }
      if (payload?.addressId) {
        params.set('addressId', payload.addressId);
      }
      return requestJson<RecentVisitRecord[]>(`/visits/recent${params.toString() ? `?${params.toString()}` : ''}`, {}, token);
    },
    correctVisit(visitId: string, payload: { outcomeCode: string; notes?: string; reason: string }) {
      return requestJson<RecentVisitRecord>(`/visits/${visitId}/correct`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      }, token);
    },
    myTurfSnapshot() {
      return requestJson<{ turf: { id: string; name: string; description?: string | null } | null; session: { id: string; startTime: string; endTime?: string | null; status?: string } | null; progress: { completed: number; total: number; pendingSync: number }; addresses: Array<{ id: string; addressLine1: string; city: string; state: string; zip?: string | null; lastResult?: string | null; lastVisitAt?: string | null }> }>('/my-turf', {}, token);
    },
    activeCanvassers() {
      return requestJson<DashboardSummary['activeCanvassers']>('/admin/active-canvassers', {}, token);
    },
    listCanvassers() {
      return requestJson<FieldUserRecord[]>('/admin/canvassers', {}, token);
    },
    listCampaigns() {
      return requestJson<CampaignRecord[]>('/admin/campaigns', {}, token);
    },
    getOperationalPolicy(campaignId?: string | null) {
      const params = new URLSearchParams();
      if (campaignId) {
        params.set('campaignId', campaignId);
      }
      return requestJson<OperationalPolicyRecord>(`/admin/policies${params.toString() ? `?${params.toString()}` : ''}`, {}, token);
    },
    retentionSummary() {
      return requestJson<RetentionSummary>('/admin/retention-summary', {}, token);
    },
    runRetentionCleanup() {
      return requestJson<{ skipped: boolean; scheduled?: boolean; summary?: RetentionSummary['dueNow']; reason?: string }>(
        '/admin/retention-run',
        { method: 'POST' },
        token
      );
    },
    updateOperationalPolicy(payload: {
      campaignId?: string | null;
      defaultImportMode?: OperationalPolicyRecord['defaultImportMode'];
      defaultDuplicateStrategy?: OperationalPolicyRecord['defaultDuplicateStrategy'];
      sensitiveMfaWindowMinutes?: number;
      canvasserCorrectionWindowMinutes?: number;
      maxAttemptsPerHousehold?: number;
      minMinutesBetweenAttempts?: number;
      geofenceRadiusFeet?: number;
      gpsLowAccuracyMeters?: number;
      refreshTokenTtlDays?: number;
      activationTokenTtlHours?: number;
      passwordResetTtlMinutes?: number;
      loginLockoutThreshold?: number;
      loginLockoutMinutes?: number;
      mfaChallengeTtlMinutes?: number;
      mfaBackupCodeCount?: number;
      retentionArchiveDays?: number | null;
      retentionPurgeDays?: number | null;
      requireArchiveReason?: boolean;
      allowOrgOutcomeFallback?: boolean;
    }) {
      return requestJson<OperationalPolicyRecord>('/admin/policies', {
        method: 'PUT',
        body: JSON.stringify(payload)
      }, token);
    },
    listOutcomeDefinitions() {
      return requestJson<OutcomeDefinitionRecord[]>('/admin/outcomes', {}, token);
    },
    createOutcomeDefinition(payload: {
      code: string;
      label: string;
      requiresNote?: boolean;
      isFinalDisposition?: boolean;
      displayOrder?: number;
      isActive?: boolean;
    }) {
      return requestJson<OutcomeDefinitionRecord>('/admin/outcomes', {
        method: 'POST',
        body: JSON.stringify(payload)
      }, token);
    },
    updateOutcomeDefinition(
      id: string,
      payload: {
        code: string;
        label: string;
        requiresNote?: boolean;
        isFinalDisposition?: boolean;
        displayOrder?: number;
        isActive?: boolean;
      }
    ) {
      return requestJson<OutcomeDefinitionRecord>(`/admin/outcomes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      }, token);
    },
    gpsReviewQueue() {
      return requestJson<GpsReviewItem[]>('/admin/gps-review', {}, token);
    },
    syncConflictQueue() {
      return requestJson<SyncConflictItem[]>('/admin/sync-conflicts', {}, token);
    },
    listExportHistory() {
      return requestJson<ExportBatchRecord[]>('/exports/history', {}, token);
    },
    downloadExportBatch(batchId: string) {
      return requestBlob(`/exports/history/${batchId}/download`, token);
    },
    listImportHistory() {
      return requestJson<ImportBatchRecord[]>('/imports/history', {}, token);
    },
    listImportReviewQueue(payload?: { take?: number }) {
      const params = new URLSearchParams();
      if (payload?.take) {
        params.set('take', String(payload.take));
      }
      return requestJson<ImportDuplicateReviewRecord[]>(
        `/imports/review-queue${params.toString() ? `?${params.toString()}` : ''}`,
        {},
        token
      );
    },
    downloadImportBatch(batchId: string) {
      return requestBlob(`/imports/history/${batchId}/download`, token);
    },
    resolveImportReview(rowId: string, action: 'merge' | 'skip', reason?: string) {
      return requestJson<{ id: string; status: string; resolutionAction?: string | null }>(
        `/imports/review-queue/${rowId}/resolve`,
        {
          method: 'POST',
          body: JSON.stringify({ action, reason })
        },
        token
      );
    },
    overrideGpsResult(visitLogId: string, reason: string) {
      return requestJson(`/admin/gps-review/${visitLogId}/override`, {
        method: 'POST',
        body: JSON.stringify({ reason })
      }, token);
    },
    resolveSyncConflict(visitLogId: string, reason: string) {
      return requestJson<SyncConflictItem>(`/admin/sync-conflicts/${visitLogId}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ reason })
      }, token);
    },
    createCanvasser(payload: {
      firstName: string;
      lastName: string;
      email: string;
      password: string;
      role?: FieldUserRecord['role'];
      campaignId?: string | null;
    }) {
      return requestJson<FieldUserRecord>('/admin/canvassers', {
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
        role: FieldUserRecord['role'];
        isActive: boolean;
        campaignId: string | null;
      }>
    ) {
      return requestJson<FieldUserRecord>(`/admin/canvassers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      }, token);
    },
    archiveCanvasser(id: string, reason?: string) {
      return requestJson<FieldUserRecord>(`/admin/canvassers/${id}/archive`, {
        method: 'PATCH',
        body: JSON.stringify({ reason })
      }, token);
    },
    deleteCanvasser(id: string, reason: string) {
      return requestJson<FieldUserRecord>(`/admin/canvassers/${id}/delete`, {
        method: 'PATCH',
        body: JSON.stringify({ reason })
      }, token);
    },
    inviteCanvasser(payload: {
      firstName: string;
      lastName: string;
      email: string;
      role?: FieldUserRecord['role'];
      campaignId?: string | null;
    }) {
      return requestJson<{ user: FieldUserRecord }>('/admin/canvassers/invite', {
        method: 'POST',
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
    archiveTurf(turfId: string, reason?: string) {
      return requestJson<TurfListItem>(`/admin/turfs/${turfId}/archive`, {
        method: 'POST',
        body: JSON.stringify({ reason })
      }, token);
    },
    deleteTurf(turfId: string, reason: string) {
      return requestJson<TurfListItem>(`/admin/turfs/${turfId}/delete`, {
        method: 'POST',
        body: JSON.stringify({ reason })
      }, token);
    },
    importTurfs(payload: {
      file: File;
      turfName?: string;
      mapping?: string;
      mode?: TurfAddressImportResult['mode'];
      duplicateStrategy?: TurfAddressImportResult['duplicateStrategy'];
    }) {
      const formData = new FormData();
      formData.append('file', payload.file);
      if (payload.turfName) {
        formData.append('turfName', payload.turfName);
      }
      if (payload.mapping) {
        formData.append('mapping', payload.mapping);
      }
      if (payload.mode) {
        formData.append('mode', payload.mode);
      }
      if (payload.duplicateStrategy) {
        formData.append('duplicateStrategy', payload.duplicateStrategy);
      }
      return requestJson<TurfAddressImportResult>('/imports/csv', {
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
    },
    exportInternalMaster(payload?: { turfId?: string }) {
      const params = new URLSearchParams();
      if (payload?.turfId) {
        params.set('turfId', payload.turfId);
      }
      return requestBlob(`/exports/internal-master${params.toString() ? `?${params.toString()}` : ''}`, token);
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
