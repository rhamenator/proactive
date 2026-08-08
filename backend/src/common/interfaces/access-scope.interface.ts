import { SupervisorScopeMode, UserRole } from '../../../generated/prisma/client.js';

export interface AccessScope {
  organizationId: string | null;
  campaignId?: string | null;
  teamId?: string | null;
  regionCode?: string | null;
  geographyNodeId?: string | null;
  role?: UserRole;
  supervisorScopeMode?: SupervisorScopeMode;
}
