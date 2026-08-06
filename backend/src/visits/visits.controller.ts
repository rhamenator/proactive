import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '../../generated/prisma/client.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import type { JwtUserPayload } from '../common/interfaces/jwt-user-payload.interface.js';
import { resolveAccessScope } from '../common/utils/access-scope.util.js';
import { PoliciesService } from '../policies/policies.service.js';
import { UsersService } from '../users/users.service.js';
import { CorrectVisitDto } from './dto/correct-visit.dto.js';
import { CreateVisitDto } from './dto/create-visit.dto.js';
import { VisitsService } from './visits.service.js';

@Controller('visits')
@UseGuards(JwtAuthGuard)
export class VisitsController {
  constructor(
    private readonly visitsService: VisitsService,
    private readonly usersService: UsersService,
    private readonly policiesService: PoliciesService
  ) {}

  private async resolveScope(user: JwtUserPayload) {
    return resolveAccessScope(user, this.usersService, this.policiesService);
  }

  @Get('outcomes')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin, UserRole.supervisor, UserRole.canvasser)
  async listActiveOutcomes(@CurrentUser() user: JwtUserPayload) {
    return this.visitsService.listActiveOutcomes(await this.resolveScope(user));
  }

  @Get('recent')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin, UserRole.supervisor, UserRole.canvasser)
  async listRecentVisits(
    @CurrentUser() user: JwtUserPayload,
    @Query('turfId') turfId?: string,
    @Query('canvasserId') canvasserId?: string,
    @Query('addressId') addressId?: string
  ) {
    return this.visitsService.listRecentVisits({
      requesterId: user.sub,
      requesterRole: user.role,
      scope: await this.resolveScope(user),
      turfId,
      canvasserId,
      addressId
    });
  }

  @Post('log')
  logVisit(@Body() body: CreateVisitDto, @CurrentUser() user: JwtUserPayload) {
    return this.visitsService.logVisit({
      canvasserId: user.sub,
      ...body
    });
  }

  @Patch(':id/correct')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin, UserRole.supervisor, UserRole.canvasser)
  async correctVisit(
    @Param('id', ParseUUIDPipe) visitId: string,
    @Body() body: CorrectVisitDto,
    @CurrentUser() user: JwtUserPayload
  ) {
    return this.visitsService.correctVisit({
      visitId,
      actorUserId: user.sub,
      actorRole: user.role,
      scope: await this.resolveScope(user),
      outcomeCode: body.outcomeCode,
      notes: body.notes,
      reason: body.reason
    });
  }
}
