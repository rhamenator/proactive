import { UserRole } from '../../../generated/prisma/client.js';

export interface JwtUserPayload {
  sub: string;
  email: string;
  role: UserRole;
  organizationId?: string | null;
  campaignId?: string | null;
  teamId?: string | null;
  mfaVerifiedAt?: string | null;
  impersonationSessionId?: string | null;
  impersonatorUserId?: string | null;
  impersonatorEmail?: string | null;
  impersonatorRole?: UserRole | null;
  impersonatorName?: string | null;
  impersonationStartedAt?: string | null;
  impersonationReasonText?: string | null;
}
