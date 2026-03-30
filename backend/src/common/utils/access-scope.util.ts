import { SupervisorScopeMode, UserRole } from '@prisma/client';
import { UsersService } from '../../users/users.service';
import { AccessScope } from '../interfaces/access-scope.interface';
import { JwtUserPayload } from '../interfaces/jwt-user-payload.interface';
import { PoliciesService } from '../../policies/policies.service';

type ScopeUser = Awaited<ReturnType<UsersService['findById']>>;

function buildScopeFromResolvedUser(
  user: Partial<ScopeUser>,
  jwtUser: JwtUserPayload,
  supervisorScopeMode?: SupervisorScopeMode
): AccessScope {
  return {
    organizationId: user.organizationId ?? jwtUser.organizationId ?? null,
    campaignId: user.campaignId ?? jwtUser.campaignId ?? null,
    teamId: user.teamId ?? jwtUser.teamId ?? null,
    regionCode: user.team?.regionCode ?? user.regionCode ?? null,
    role: user.role ?? jwtUser.role,
    supervisorScopeMode
  };
}

export async function resolveAccessScope(
  user: JwtUserPayload,
  usersService: UsersService,
  policiesService?: PoliciesService
): Promise<AccessScope> {
  const needsLookup =
    user.organizationId === undefined ||
    user.campaignId === undefined ||
    user.role === UserRole.supervisor ||
    (policiesService !== undefined && user.teamId !== undefined);

  const currentUser = needsLookup ? await usersService.findById(user.sub) : null;
  const resolvedOrganizationId = currentUser?.organizationId ?? user.organizationId ?? null;
  const resolvedCampaignId = currentUser?.campaignId ?? user.campaignId ?? null;
  const resolvedRole = currentUser?.role ?? user.role;
  const resolvedUser =
    currentUser ??
    ({
      organizationId: resolvedOrganizationId,
      campaignId: resolvedCampaignId,
      teamId: user.teamId ?? null,
      role: resolvedRole
    } satisfies Partial<ScopeUser>);

  let supervisorScopeMode: SupervisorScopeMode | undefined;
  if (policiesService && resolvedRole === UserRole.supervisor && resolvedOrganizationId) {
    const policy = await policiesService.getEffectivePolicy({
      organizationId: resolvedOrganizationId,
      campaignId: resolvedCampaignId
    });
    supervisorScopeMode = policy?.supervisorScopeMode;
  }

  return buildScopeFromResolvedUser(resolvedUser, user, supervisorScopeMode);
}
