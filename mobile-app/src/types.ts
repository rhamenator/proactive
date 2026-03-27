export type Role = 'admin' | 'canvasser';

export type VisitResult =
  | 'knocked'
  | 'lit_drop'
  | 'not_home'
  | 'refused'
  | 'talked_to_voter';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
}

export interface Turf {
  id: string;
  name: string;
  description?: string | null;
  createdAt?: string;
}

export interface TurfSession {
  id: string;
  turfId: string;
  canvasserId: string;
  startTime: string;
  endTime?: string | null;
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

export interface VisitSubmission {
  turfId: string;
  addressId: string;
  result: VisitResult;
  contactMade: boolean;
  notes?: string;
  latitude: number;
  longitude: number;
  submittedAt: string;
}

export interface QueuedVisit {
  id: string;
  createdAt: string;
  payload: VisitSubmission;
  addressMeta: {
    addressLine1: string;
    city: string;
    state: string;
    zip?: string | null;
    vanId?: string | null;
  };
}

export interface AddressState {
  result: VisitResult | null;
  submittedAt: string | null;
  synced: boolean;
}

export interface LoginResponse {
  token: string;
  accessToken?: string;
  role: Role;
  user: User;
}
