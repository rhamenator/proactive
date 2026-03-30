export type Role = 'admin' | 'supervisor' | 'canvasser';

export interface SafeUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  organizationId?: string | null;
  campaignId?: string | null;
  isActive: boolean;
  status: string;
  createdAt: string;
  impersonation?: {
    sessionId: string;
    actorUserId: string;
    actorEmail?: string | null;
    actorRole?: Role | null;
    actorName?: string | null;
    startedAt?: string | null;
    reasonText?: string | null;
  } | null;
}

export interface OutcomeDefinitionRecord {
  id: string;
  code: string;
  label: string;
  requiresNote: boolean;
  isFinalDisposition: boolean;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
}

export interface OperationalPolicyRecord {
  id?: string | null;
  organizationId?: string | null;
  campaignId?: string | null;
  sourceScope: 'default' | 'organization' | 'campaign';
  explicitRecord: boolean;
  inheritedFromOrganization: boolean;
  defaultImportMode: 'create_only' | 'upsert' | 'replace_turf_membership';
  defaultDuplicateStrategy: 'skip' | 'error' | 'merge' | 'review';
  sensitiveMfaWindowMinutes: number;
  retentionArchiveDays?: number | null;
  retentionPurgeDays?: number | null;
  requireArchiveReason: boolean;
  allowOrgOutcomeFallback: boolean;
}

export interface GpsReviewItem {
  id: string;
  visitLogId: string;
  gpsStatus: 'verified' | 'flagged' | 'missing' | 'low_accuracy';
  failureReason?: string | null;
  distanceFromTargetFeet?: string | number | null;
  validationRadiusFeet: number;
  overrideFlag: boolean;
  overrideReason?: string | null;
  overrideAt?: string | null;
  address: {
    id: string;
    addressLine1: string;
    city: string;
    state: string;
    zip?: string | null;
  };
  visitLog: {
    id: string;
    outcomeCode?: string | null;
    outcomeLabel?: string | null;
    result?: string | null;
    notes?: string | null;
    visitTime: string;
    canvasser: SafeUser;
    turf: {
      id: string;
      name: string;
    };
  };
}

export interface SyncConflictItem {
  id: string;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed' | 'conflict';
  syncConflictFlag: boolean;
  syncConflictReason?: string | null;
  localRecordUuid?: string | null;
  idempotencyKey?: string | null;
  source: 'mobile_app' | 'web_app' | 'csv_import' | 'admin_entry';
  outcomeCode?: string | null;
  outcomeLabel?: string | null;
  result?: string | null;
  notes?: string | null;
  visitTime: string;
  address: {
    id: string;
    addressLine1: string;
    city: string;
    state: string;
    zip?: string | null;
  };
  canvasser: SafeUser;
  turf: {
    id: string;
    name: string;
  };
}

export interface ExportBatchRecord {
  id: string;
  profileCode: string;
  filename: string;
  organizationId?: string | null;
  campaignId?: string | null;
  turfId?: string | null;
  markExported: boolean;
  rowCount: number;
  createdAt: string;
  csvContent?: string | null;
  sha256Checksum?: string | null;
  _count?: {
    exportedVisits: number;
  };
  turf?: {
    id: string;
    name: string;
  } | null;
  initiatedByUser?: SafeUser | null;
}

export interface CampaignRecord {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  organizationId?: string | null;
  createdAt?: string;
}

export interface LoginResponse {
  mfaRequired?: false;
  token?: string;
  accessToken?: string;
  role?: Role;
  user: SafeUser;
  backupCodes?: string[];
}

export interface MfaChallengeResponse {
  mfaRequired: true;
  setupRequired: boolean;
  challengeToken: string;
  role?: Role;
  user: SafeUser;
}

export type AuthLoginResponse = LoginResponse | MfaChallengeResponse;

export interface MfaSetupInitResponse {
  secret: string;
  otpauthUri: string;
}

export interface MfaStatusResponse {
  enabled: boolean;
  required: boolean;
  backupCodeCount: number;
}

export interface MfaStepUpResponse extends LoginResponse {}

export interface ReportFilters {
  dateFrom?: string;
  dateTo?: string;
  turfId?: string;
  canvasserId?: string;
  campaignId?: string;
  outcomeCode?: string;
  overrideFlag?: boolean;
  syncStatus?: SyncConflictItem['syncStatus'];
  gpsStatus?: GpsReviewItem['gpsStatus'];
}

export interface ReportOverview {
  filters: ReportFilters & { limit?: number | null };
  dataFreshness: {
    reflectsSyncedDataOnly: boolean;
    pendingSyncRecords: number;
    failedSyncRecords: number;
    conflictRecords: number;
  };
  kpis: {
    totalVisits: number;
    uniqueAddressesVisited: number;
    contactsMade: number;
    activeCanvassers: number;
    syncStatus: {
      pending: number;
      syncing: number;
      synced: number;
      failed: number;
      conflict: number;
    };
    gpsStatus: {
      verified: number;
      flagged: number;
      missing: number;
      lowAccuracy: number;
      overrides: number;
    };
  };
  productivityPreview: Array<{
    canvasserId: string;
    canvasserName: string;
    email: string;
    totalVisits: number;
    uniqueAddressesVisited: number;
    contactsMade: number;
  }>;
  recentAuditActivity: AuditActivityItem[];
}

export interface ProductivityRow {
  canvasserId: string;
  canvasserName: string;
  email: string;
  totalVisits: number;
  uniqueAddressesVisited: number;
  contactsMade: number;
  sessionsCount: number;
  totalSessionMinutes: number;
  averageSessionMinutes: number;
  housesPerHour: number;
  gpsVerifiedRate: number;
  gpsFlaggedRate: number;
}

export interface ProductivityReport {
  filters: ReportFilters & { limit?: number | null };
  summary: {
    totalCanvassers: number;
    totalVisits: number;
    totalUniqueAddressesVisited: number;
    averageHousesPerHour: number;
  };
  rows: ProductivityRow[];
}

export interface TrendReport {
  filters: ReportFilters & { limit?: number | null };
  summary: {
    days: number;
    totalVisits: number;
    averageVisitsPerDay: number;
  };
  byDay: Array<{
    day: string;
    visits: number;
    contactsMade: number;
    uniqueAddressesVisited: number;
  }>;
  byOutcome: Array<{
    outcomeCode: string;
    outcomeLabel: string;
    total: number;
  }>;
}

export interface ResolvedConflictItem {
  id: string;
  visitLogId: string;
  resolvedAt: string;
  reasonText?: string | null;
  actorUser?: SafeUser | null;
  oldValuesJson?: unknown;
  newValuesJson?: unknown;
}

export interface ResolvedConflictReport {
  filters: ReportFilters & { limit?: number | null };
  summary: {
    totalResolved: number;
  };
  rows: ResolvedConflictItem[];
}

export interface ExportBatchAnalyticsReport {
  filters: ReportFilters & { limit?: number | null };
  summary: {
    totalBatches: number;
    totalRows: number;
    artifactBackedBatches: number;
    byProfile: Array<{ profileCode: string; count: number }>;
  };
  rows: Array<{
    id: string;
    profileCode: string;
    filename: string;
    createdAt: string;
    rowCount: number;
    markExported: boolean;
    hasStoredArtifact: boolean;
    checksum?: string | null;
    turf?: {
      id: string;
      name: string;
    } | null;
    initiatedByUser?: SafeUser | null;
    traceableVisitCount: number;
  }>;
}

export interface GpsExceptionRow {
  visitId: string;
  visitTime: string;
  canvasser: {
    id: string;
    name: string;
    email: string;
  };
  turf: {
    id: string;
    name: string;
  };
  address: {
    id: string;
    addressLine1: string;
    city: string;
    state: string;
    zip?: string | null;
  };
  outcome: {
    code: string;
    label: string;
    result: string;
  };
  syncStatus: SyncConflictItem['syncStatus'];
  gpsStatus: GpsReviewItem['gpsStatus'];
  geofence: {
    distanceFromTargetFeet: number | null;
    accuracyMeters: number | null;
    validationRadiusFeet: number | null;
    failureReason: string | null;
  };
  override: {
    flag: boolean;
    reason: string | null;
    approvedAt: string | null;
    approvedBy:
      | {
          id: string;
          name: string;
          email: string;
        }
      | null;
  };
}

export interface GpsExceptionsReport {
  filters: ReportFilters & { limit?: number | null };
  summary: {
    totalExceptions: number;
    flagged: number;
    missing: number;
    lowAccuracy: number;
    overrides: number;
    byCanvasser: Array<{ canvasserId: string; canvasserName: string; total: number }>;
    byTurf: Array<{ turfId: string; turfName: string; total: number }>;
  };
  rows: GpsExceptionRow[];
}

export interface AuditActivityReport {
  filters: ReportFilters & { limit?: number | null };
  summary: {
    totalEntries: number;
    byActionType: Array<{ actionType: string; count: number }>;
    byEntityType: Array<{ entityType: string; count: number }>;
  };
  rows: AuditActivityItem[];
}

export interface RetentionSummary {
  automation: {
    enabled: boolean;
    intervalMinutes: number;
  };
  dueNow: {
    addressRequests: number;
    importBatches: number;
    exportBatches: number;
    refreshTokens: number;
    activationTokens: number;
    passwordResetTokens: number;
    mfaChallenges: number;
    usedBackupCodes: number;
  };
  lastRunAt?: string | null;
}

export interface ImpersonationStartResponse extends LoginResponse {
  user: SafeUser;
}

export interface AddressRequestRecord {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
  reviewedAt?: string | null;
  reviewReason?: string | null;
  notes?: string | null;
  organizationId?: string | null;
  campaignId?: string | null;
  requestedAddress: {
    addressLine1: string;
    city: string;
    state: string;
    zip?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  };
  turf: {
    id: string;
    name: string;
  };
  requestedBy: SafeUser;
  reviewedBy?: SafeUser | null;
  approvedAddress?: {
    id: string;
    addressLine1: string;
    city: string;
    state: string;
    zip?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
}

export interface RecentVisitRecord {
  id: string;
  visitTime: string;
  outcomeCode: string;
  outcomeLabel: string;
  result: string;
  notes?: string | null;
  canvasser: SafeUser;
  turf: {
    id: string;
    name: string;
  };
  address: {
    id: string;
    addressLine1: string;
    city: string;
    state: string;
    zip?: string | null;
  };
  geofenceResult?: {
    overrideFlag: boolean;
  } | null;
}

export interface AuditActivityItem {
  id: string;
  actionType: string;
  entityType: string;
  entityId: string;
  reasonCode?: string | null;
  createdAt: string;
  actorUser?: SafeUser | null;
}

export interface DisableMfaResponse {
  success: boolean;
  setupRequiredOnNextLogin: boolean;
}

export interface TurfListItem {
  id: string;
  name: string;
  description?: string | null;
  lifecycleStatus?: 'open' | 'paused' | 'completed' | 'closed';
  createdAt: string;
  _count?: {
    addresses: number;
    assignments: number;
    sessions: number;
    visits: number;
  };
  activeSessionCount?: number;
}

export interface DashboardSummary {
  totals: {
    users: number;
    admins: number;
    supervisors: number;
    canvassers: number;
    turfs: number;
    addresses: number;
    assignments: number;
    activeSessions: number;
    visits: number;
    completedAddresses: number;
  };
  activeCanvassers: Array<{
    id: string;
    startTime: string;
    canvasser: SafeUser;
    turf: {
      id: string;
      name: string;
    };
  }>;
  turfs: Array<{
    id: string;
    name: string;
    description?: string | null;
    lifecycleStatus?: 'open' | 'paused' | 'completed' | 'closed';
    addressCount: number;
    assignmentCount: number;
    activeSessionCount: number;
    visitCount: number;
    progressPercent: number;
  }>;
}

export interface FieldUserRecord extends SafeUser {
  role: Role;
}

export type CanvasserRecord = FieldUserRecord;

export interface TurfAddressImportResult {
  importBatchId: string;
  filename: string;
  mode: 'create_only' | 'upsert' | 'replace_turf_membership';
  duplicateStrategy: 'skip' | 'error' | 'merge' | 'review';
  turfsCreated: number;
  addressesImported: number;
  replacedMembershipsRemoved?: number;
  invalidRowsSkipped?: number;
  duplicateRowsSkipped?: number;
  duplicateRowsMerged?: number;
  pendingDuplicateReviews?: number;
  turfs: TurfListItem[];
}

export interface ImportBatchRecord {
  id: string;
  filename: string;
  mode: string;
  duplicateStrategy: string;
  rowCount: number;
  importedCount: number;
  mergedCount: number;
  removedCount?: number;
  pendingReviewCount?: number;
  invalidCount: number;
  duplicateSkippedCount: number;
  createdAt: string;
  initiatedByUser?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: Role;
  } | null;
  _count?: {
    rows: number;
  };
}

export interface ImportDuplicateReviewRecord {
  id: string;
  rowIndex: number;
  turfName?: string | null;
  status: 'pending_review' | 'merged' | 'skipped_duplicate';
  reasonCode?: string | null;
  createdAt: string;
  rawRow: Record<string, unknown>;
  importBatch: {
    id: string;
    filename: string;
    createdAt: string;
    mode: string;
    duplicateStrategy: string;
  };
  candidateAddress?: {
    id: string;
    addressLine1: string;
    city: string;
    state: string;
    zip?: string | null;
    vanId?: string | null;
    turf?: {
      id: string;
      name: string;
    } | null;
  } | null;
  household?: {
    id: string;
    addressLine1: string;
    city: string;
    state: string;
    zip?: string | null;
    vanHouseholdId?: string | null;
    vanPersonId?: string | null;
  } | null;
}

export interface TurfSessionSnapshot {
  assignment?: unknown;
  turf: {
    id: string;
    name: string;
    description?: string | null;
    addresses?: Array<{
      id: string;
      addressLine1: string;
      city: string;
      state: string;
      zip?: string | null;
      vanId?: string | null;
      visitLogs?: Array<{
        result: string;
        outcomeCode?: string;
        outcomeLabel?: string;
        visitTime: string;
      }>;
    }>;
    _count?: {
      addresses: number;
      visits: number;
    };
  } | null;
  activeSession?: {
    id: string;
    startTime: string;
    endTime?: string | null;
  } | null;
}
