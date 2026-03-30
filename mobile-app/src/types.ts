export type Role = 'admin' | 'supervisor' | 'canvasser';

export type VisitResult = string;

export type GpsStatus = 'verified' | 'flagged' | 'missing' | 'low_accuracy';

export type VisitSyncStatus = 'pending' | 'syncing' | 'synced' | 'failed' | 'conflict';

export interface OutcomeDefinition {
  id: string;
  code: string;
  label: string;
  requiresNote: boolean;
  isFinalDisposition: boolean;
  displayOrder: number;
  isActive: boolean;
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
}

export interface AddressRequestRecord {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
  reviewedAt?: string | null;
  reviewReason?: string | null;
  notes?: string | null;
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
}

export interface Turf {
  id: string;
  name: string;
  description?: string | null;
  lifecycleStatus?: 'open' | 'paused' | 'completed' | 'closed';
  createdAt?: string;
}

export interface TurfSession {
  id: string;
  turfId: string;
  canvasserId: string;
  startTime: string;
  endTime?: string | null;
  status?: 'active' | 'paused' | 'completed';
  startLat?: number | null;
  startLng?: number | null;
  endLat?: number | null;
  endLng?: number | null;
}

export interface Address {
  id: string;
  turfId: string;
  addressLine1: string;
  city: string;
  state: string;
  zip?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  vanId?: string | null;
  status?: 'pending' | 'completed';
  lastResult?: VisitResult | null;
  lastOutcomeCode?: string | null;
  lastVisitAt?: string | null;
  pendingSync?: boolean;
}

export interface TurfProgress {
  completed: number;
  total: number;
  pendingSync: number;
}

export interface TurfSnapshot {
  turf: Turf | null;
  session: TurfSession | null;
  progress: TurfProgress;
  addresses: Address[];
}

export interface SessionNote {
  id: string;
  turfId: string;
  sessionId: string | null;
  createdAt: string;
  updatedAt: string;
  addressText?: string | null;
  noteText: string;
}

export interface VisitSubmission {
  localRecordUuid: string;
  idempotencyKey: string;
  clientCreatedAt: string;
  submittedAt: string;
  turfId: string;
  sessionId?: string | null;
  addressId: string;
  outcomeCode: string;
  contactMade: boolean;
  notes?: string;
  latitude?: number | null;
  longitude?: number | null;
  accuracyMeters?: number | null;
  gpsStatus: GpsStatus;
  gpsFailureReason?: string | null;
  capturedAt: string;
}

export interface QueuedVisit {
  id: string;
  localRecordUuid: string;
  createdAt: string;
  syncStatus: VisitSyncStatus;
  syncConflictReason?: string | null;
  payload: VisitSubmission;
  addressMeta: {
    addressLine1: string;
    city: string;
    state: string;
    zip?: string | null;
    vanId?: string | null;
  };
}

export interface RecentVisitRecord {
  id: string;
  visitTime: string;
  outcomeCode: string;
  outcomeLabel: string;
  result: string;
  notes?: string | null;
  address: {
    id: string;
    addressLine1: string;
    city: string;
    state: string;
    zip?: string | null;
  };
  turf: {
    id: string;
    name: string;
  };
}

export interface AddressState {
  result: VisitResult | null;
  outcomeCode?: string | null;
  submittedAt: string | null;
  synced: boolean;
  syncStatus: VisitSyncStatus;
  syncConflictReason?: string | null;
  localRecordUuid?: string | null;
  clientCreatedAt?: string | null;
  sessionId?: string | null;
  gpsStatus?: GpsStatus | null;
  accuracyMeters?: number | null;
}

export interface LoginResponse {
  token: string;
  accessToken?: string;
  role: Role;
  user: User;
}

export interface SelfPerformanceReport {
  overview: {
    filters: Record<string, unknown>;
    kpis: {
      totalVisits: number;
      contactsMade: number;
      gpsStatus: {
        verified: number;
        flagged: number;
        missing: number;
        lowAccuracy: number;
        overrides: number;
      };
      outcomes: {
        finalDisposition: number;
        attemptsOnly: number;
      };
      revisitVisits: number;
    };
    dataFreshness: {
      pendingSyncRecords: number;
      failedSyncRecords: number;
      conflictRecords: number;
      reflectsSyncedDataOnly: boolean;
    };
  };
  productivity: {
    canvasserId: string;
    canvasserName: string;
    email: string;
    totalVisits: number;
    uniqueAddressesVisited: number;
    contactsMade: number;
    finalDispositionVisits: number;
    revisitVisits: number;
    sessionsCount: number;
    totalSessionMinutes: number;
    averageSessionMinutes: number;
    housesPerHour: number;
    gpsVerifiedRate: number;
    gpsFlaggedRate: number;
  } | null;
  trends: {
    bucketTimeZone: string;
    summary: {
      days: number;
      totalVisits: number;
      averageVisitsPerDay: number;
      finalDispositionVisits: number;
      attemptOnlyVisits: number;
      revisitVisits: number;
    };
    byDay: Array<{
      day: string;
      visits: number;
      contactsMade: number;
      uniqueAddressesVisited: number;
    }>;
  };
}
