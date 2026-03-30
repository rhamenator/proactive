import { SupervisorScopeMode, UserRole } from '@prisma/client';

export interface AccessScope {
  organizationId: string | null;
  campaignId?: string | null;
  teamId?: string | null;
  regionCode?: string | null;
  role?: UserRole;
  supervisorScopeMode?: SupervisorScopeMode;
}
