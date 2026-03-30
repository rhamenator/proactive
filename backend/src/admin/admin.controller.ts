import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthService } from '../auth/auth.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireFreshMfa } from '../common/decorators/require-fresh-mfa.decorator';
import { FreshMfaGuard } from '../common/guards/fresh-mfa.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtUserPayload } from '../common/interfaces/jwt-user-payload.interface';
import { resolveAccessScope } from '../common/utils/access-scope.util';
import { TurfsService } from '../turfs/turfs.service';
import { UsersService } from '../users/users.service';
import { InviteCanvasserDto } from './dto/invite-canvasser.dto';
import { ResolveSyncConflictDto } from './dto/resolve-sync-conflict.dto';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard, FreshMfaGuard)
@Roles(UserRole.admin)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
    private readonly turfsService: TurfsService
  ) {}

  private async resolveScope(user: JwtUserPayload) {
    return resolveAccessScope(user, this.usersService);
  }

  private enforceRequestedCampaign(scope: { organizationId: string | null; campaignId?: string | null }, requestedCampaignId?: string | null) {
    if (!scope.campaignId) {
      return requestedCampaignId ?? null;
    }

    if (requestedCampaignId === undefined) {
      return scope.campaignId;
    }

    if (requestedCampaignId !== scope.campaignId) {
      throw new ForbiddenException('You cannot assign users outside your campaign scope');
    }

    return requestedCampaignId;
  }

  private async assertTargetUserScope(userId: string, scope: { organizationId: string | null; campaignId?: string | null }) {
    if (!scope.campaignId) {
      return;
    }

    const targetUser = await this.usersService.findById(userId);
    if (targetUser.organizationId !== scope.organizationId || targetUser.campaignId !== scope.campaignId) {
      throw new BadRequestException('Target user is outside your campaign scope');
    }
  }

  @Get('dashboard-summary')
  @Roles(UserRole.admin, UserRole.supervisor)
  async dashboardSummary(@CurrentUser() user: JwtUserPayload) {
    return this.adminService.dashboardSummary(await this.resolveScope(user));
  }

  @Get('active-canvassers')
  @Roles(UserRole.admin, UserRole.supervisor)
  async activeCanvassers(@CurrentUser() user: JwtUserPayload) {
    return this.adminService.activeCanvassers(await this.resolveScope(user));
  }

  @Get('canvassers')
  @Roles(UserRole.admin, UserRole.supervisor)
  async listCanvassers(@CurrentUser() user: JwtUserPayload) {
    return this.adminService.listCanvassers(await this.resolveScope(user));
  }

  @Get('campaigns')
  @Roles(UserRole.admin, UserRole.supervisor)
  async listCampaigns(@CurrentUser() user: JwtUserPayload) {
    return this.adminService.listCampaigns(await this.resolveScope(user));
  }

  @Get('outcomes')
  @Roles(UserRole.admin, UserRole.supervisor)
  async listOutcomeDefinitions(@CurrentUser() user: JwtUserPayload) {
    return this.adminService.listOutcomeDefinitions(await this.resolveScope(user));
  }

  @Post('outcomes')
  async createOutcomeDefinition(
    @Body()
    body: {
      code: string;
      label: string;
      requiresNote?: boolean;
      isFinalDisposition?: boolean;
      displayOrder?: number;
      isActive?: boolean;
    },
    @CurrentUser() user: JwtUserPayload
  ) {
    return this.adminService.upsertOutcomeDefinition(body, await this.resolveScope(user));
  }

  @Patch('outcomes/:id')
  async updateOutcomeDefinition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      code: string;
      label: string;
      requiresNote?: boolean;
      isFinalDisposition?: boolean;
      displayOrder?: number;
      isActive?: boolean;
    },
    @CurrentUser() user: JwtUserPayload
  ) {
    return this.adminService.upsertOutcomeDefinition({
      id,
      ...body
    }, await this.resolveScope(user));
  }

  @Get('gps-review')
  @Roles(UserRole.admin, UserRole.supervisor)
  async gpsReviewQueue(@CurrentUser() user: JwtUserPayload) {
    return this.adminService.gpsReviewQueue(await this.resolveScope(user));
  }

  @Get('sync-conflicts')
  @Roles(UserRole.admin, UserRole.supervisor)
  async syncConflictQueue(@CurrentUser() user: JwtUserPayload) {
    return this.adminService.syncConflictQueue(await this.resolveScope(user));
  }

  @Post('gps-review/:visitLogId/override')
  @Roles(UserRole.admin, UserRole.supervisor)
  @RequireFreshMfa()
  async overrideGpsResult(
    @Param('visitLogId', ParseUUIDPipe) visitLogId: string,
    @Body() body: { reason: string },
    @CurrentUser() user: JwtUserPayload
  ) {
    return this.adminService.overrideGpsResult({
      visitLogId,
      actorUserId: user.sub,
      scope: await this.resolveScope(user),
      reason: body.reason
    });
  }

  @Post('sync-conflicts/:visitLogId/resolve')
  @Roles(UserRole.admin, UserRole.supervisor)
  @RequireFreshMfa()
  async resolveSyncConflict(
    @Param('visitLogId', ParseUUIDPipe) visitLogId: string,
    @Body() body: ResolveSyncConflictDto,
    @CurrentUser() user: JwtUserPayload
  ) {
    return this.adminService.resolveSyncConflict({
      visitLogId,
      actorUserId: user.sub,
      scope: await this.resolveScope(user),
      reason: body.reason
    });
  }

  @Post('canvassers')
  async createCanvasser(
    @Body()
    body: { firstName: string; lastName: string; email: string; password: string; role?: UserRole; campaignId?: string | null },
    @CurrentUser() user: JwtUserPayload
  ) {
    const scope = await this.resolveScope(user);
    const campaignId = this.enforceRequestedCampaign(scope, body.campaignId);
    return this.usersService.createCanvasser({
      ...body,
      organizationId: scope.organizationId,
      campaignId
    });
  }

  @Post('canvassers/invite')
  async inviteCanvasser(@Body() body: InviteCanvasserDto, @CurrentUser() user: JwtUserPayload) {
    const scope = await this.resolveScope(user);
    const campaignId = this.enforceRequestedCampaign(scope, body.campaignId);
    return this.authService.inviteCanvasser({
      ...body,
      actorUserId: user.sub,
      organizationId: scope.organizationId,
      campaignId
    });
  }

  @Patch('canvassers/:id')
  async updateCanvasser(
    @Param('id') id: string,
    @Body()
    body: Partial<{ firstName: string; lastName: string; email: string; password: string; role: UserRole; isActive: boolean; campaignId: string | null }>,
    @CurrentUser() user: JwtUserPayload
  ) {
    const scope = await this.resolveScope(user);
    await this.assertTargetUserScope(id, scope);
    const nextCampaignId = body.campaignId === undefined ? undefined : this.enforceRequestedCampaign(scope, body.campaignId);
    return this.usersService.updateCanvasser(id, {
      ...body,
      organizationId: scope.organizationId,
      ...(nextCampaignId !== undefined ? { campaignId: nextCampaignId } : {})
    });
  }

  @Post('turfs/:id/reassign')
  @Roles(UserRole.admin, UserRole.supervisor)
  @RequireFreshMfa()
  async reassignTurf(
    @Param('id', ParseUUIDPipe) turfId: string,
    @Body() body: { canvasserId: string; reason?: string },
    @CurrentUser() user: JwtUserPayload
  ) {
    return this.turfsService.assignTurf(
      turfId,
      body.canvasserId,
      user.sub,
      body.reason,
      await this.resolveScope(user)
    );
  }

  @Post('turfs/:id/reopen')
  @Roles(UserRole.admin, UserRole.supervisor)
  @RequireFreshMfa()
  async reopenTurf(
    @Param('id', ParseUUIDPipe) turfId: string,
    @Body() body: { reason?: string },
    @CurrentUser() user: JwtUserPayload
  ) {
    return this.turfsService.reopenTurf(turfId, user.sub, body.reason, await this.resolveScope(user));
  }
}
