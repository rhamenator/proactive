export type Role = 'admin' | 'supervisor' | 'canvasser';

export interface SafeUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
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
  turfId?: string | null;
  markExported: boolean;
  rowCount: number;
  createdAt: string;
  turf?: {
    id: string;
    name: string;
  } | null;
  initiatedByUser?: SafeUser | null;
}

export interface LoginResponse {
  mfaRequired?: false;
  token?: string;
  accessToken?: string;
  role?: Role;
  user: SafeUser;
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
  turfsCreated: number;
  addressesImported: number;
  turfs: TurfListItem[];
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
