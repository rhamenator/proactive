import { JwtUserPayload } from '../interfaces/jwt-user-payload.interface';
import { UsersService } from '../../users/users.service';
import { AccessScope } from '../interfaces/access-scope.interface';

export async function resolveAccessScope(user: JwtUserPayload, usersService: UsersService): Promise<AccessScope> {
  if (user.organizationId !== undefined || user.campaignId !== undefined) {
    return {
      organizationId: user.organizationId ?? null,
      campaignId: user.campaignId ?? null
    };
  }

  const currentUser = await usersService.findById(user.sub);
  return {
    organizationId: currentUser.organizationId ?? null,
    campaignId: currentUser.campaignId ?? null
  };
}
