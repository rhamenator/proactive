import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { RecoveryCaseType, UserRole } from '../../generated/prisma/client.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequireFreshMfa } from '../common/decorators/require-fresh-mfa.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { FreshMfaGuard } from '../common/guards/fresh-mfa.guard.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import type { JwtUserPayload } from '../common/interfaces/jwt-user-payload.interface.js';
import { RecoveryService } from './recovery.service.js';

@Controller('admin/recovery-cases')
@UseGuards(JwtAuthGuard, RolesGuard, FreshMfaGuard)
@Roles(UserRole.admin)
export class RecoveryController {
  constructor(private readonly recovery: RecoveryService) {}

  @Get()
  list(@CurrentUser() user: JwtUserPayload) {
    return this.recovery.list(user.sub);
  }

  @Get('targets')
  targets(@CurrentUser() user: JwtUserPayload) {
    return this.recovery.listTargets(user.sub);
  }

  @Post()
  @RequireFreshMfa()
  request(
    @CurrentUser() user: JwtUserPayload,
    @Body() body: { targetUserId: string; type: RecoveryCaseType; reason: string }
  ) {
    return this.recovery.request({ actorUserId: user.sub, ...body });
  }

  @Post(':id/approve')
  @RequireFreshMfa()
  approve(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtUserPayload, @Body() body: { reason: string }) {
    return this.recovery.approve({ actorUserId: user.sub, caseId: id, reason: body.reason });
  }

  @Post(':id/reject')
  @RequireFreshMfa()
  reject(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtUserPayload, @Body() body: { reason: string }) {
    return this.recovery.reject({ actorUserId: user.sub, caseId: id, reason: body.reason });
  }
}
