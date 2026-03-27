export type Role = 'admin' | 'canvasser';

export interface SafeUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
}

export interface LoginResponse {
  token?: string;
  accessToken: string;
  role?: Role;
  user: SafeUser;
}

export interface TurfListItem {
  id: string;
  name: string;
  description?: string | null;
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
    addressCount: number;
    assignmentCount: number;
    activeSessionCount: number;
    visitCount: number;
    progressPercent: number;
  }>;
}

export interface CanvasserRecord extends SafeUser {}

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
