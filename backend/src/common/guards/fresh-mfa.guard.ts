import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { getSensitiveMfaWindowMinutes } from '../../auth/sensitive-mfa.util';
import { REQUIRE_FRESH_MFA_KEY } from '../decorators/require-fresh-mfa.decorator';
import { JwtUserPayload } from '../interfaces/jwt-user-payload.interface';

@Injectable()
export class FreshMfaGuard implements CanActivate {
  private readonly defaultFreshMfaMinutes = getSensitiveMfaWindowMinutes();

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
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
    const allowedMinutes = typeof configured === 'number' ? configured : this.defaultFreshMfaMinutes;

    if (!verifiedAt || Number.isNaN(verifiedAt.getTime())) {
      throw new ForbiddenException('Recent MFA verification is required for this action');
    }

    if (Date.now() - verifiedAt.getTime() > allowedMinutes * 60 * 1000) {
      throw new ForbiddenException('Recent MFA verification is required for this action');
    }

    return true;
  }
}
