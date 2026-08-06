import { type CanActivate, type ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../../generated/prisma/client.js';
import { PoliciesService } from '../../policies/policies.service.js';
import { REQUIRE_FRESH_MFA_KEY } from '../decorators/require-fresh-mfa.decorator.js';
import type { JwtUserPayload } from '../interfaces/jwt-user-payload.interface.js';

@Injectable()
export class FreshMfaGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly policiesService: PoliciesService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const configured = this.reflector.getAllAndOverride<number | boolean | undefined>(REQUIRE_FRESH_MFA_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (configured === undefined || configured === false) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: JwtUserPayload }>();
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Missing authenticated user');
    }

    if (user.impersonatorUserId) {
      throw new ForbiddenException('Sensitive actions are unavailable during impersonation');
    }

    if (user.role !== UserRole.admin && user.role !== UserRole.supervisor) {
      return true;
    }

    const verifiedAt = user.mfaVerifiedAt ? new Date(user.mfaVerifiedAt) : null;
    const policy = await this.policiesService.getEffectivePolicy({
      organizationId: user.organizationId ?? null,
      campaignId: user.campaignId ?? null
    });
    const allowedMinutes = typeof configured === 'number' ? configured : policy.sensitiveMfaWindowMinutes;

    if (!verifiedAt || Number.isNaN(verifiedAt.getTime())) {
      throw new ForbiddenException('Recent MFA verification is required for this action');
    }

    if (Date.now() - verifiedAt.getTime() > allowedMinutes * 60 * 1000) {
      throw new ForbiddenException('Recent MFA verification is required for this action');
    }

    return true;
  }
}
