import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthService } from '../auth/auth.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtUserPayload } from '../common/interfaces/jwt-user-payload.interface';
import { TurfsService } from '../turfs/turfs.service';
import { UsersService } from '../users/users.service';
import { InviteCanvasserDto } from './dto/invite-canvasser.dto';
import { ResolveSyncConflictDto } from './dto/resolve-sync-conflict.dto';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.admin)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
    private readonly turfsService: TurfsService
  ) {}

  private async resolveOrganizationId(user: JwtUserPayload) {
    if (user.organizationId !== undefined) {
      return user.organizationId ?? null;
    }

    const currentUser = await this.usersService.findById(user.sub);
    return currentUser.organizationId ?? null;
  }

  @Get('dashboard-summary')
  @Roles(UserRole.admin, UserRole.supervisor)
  async dashboardSummary(@CurrentUser() user: JwtUserPayload) {
    return this.adminService.dashboardSummary(await this.resolveOrganizationId(user));
  }

  @Get('active-canvassers')
  @Roles(UserRole.admin, UserRole.supervisor)
  async activeCanvassers(@CurrentUser() user: JwtUserPayload) {
    return this.adminService.activeCanvassers(await this.resolveOrganizationId(user));
  }

  @Get('canvassers')
  @Roles(UserRole.admin, UserRole.supervisor)
  async listCanvassers(@CurrentUser() user: JwtUserPayload) {
    return this.adminService.listCanvassers(await this.resolveOrganizationId(user));
  }

  @Get('outcomes')
  @Roles(UserRole.admin, UserRole.supervisor)
  async listOutcomeDefinitions(@CurrentUser() user: JwtUserPayload) {
    return this.adminService.listOutcomeDefinitions(await this.resolveOrganizationId(user));
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
    return this.adminService.upsertOutcomeDefinition(body, await this.resolveOrganizationId(user));
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
    }, await this.resolveOrganizationId(user));
  }

  @Get('gps-review')
  @Roles(UserRole.admin, UserRole.supervisor)
  async gpsReviewQueue(@CurrentUser() user: JwtUserPayload) {
    return this.adminService.gpsReviewQueue(await this.resolveOrganizationId(user));
  }

  @Get('sync-conflicts')
  @Roles(UserRole.admin, UserRole.supervisor)
  async syncConflictQueue(@CurrentUser() user: JwtUserPayload) {
    return this.adminService.syncConflictQueue(await this.resolveOrganizationId(user));
  }

  @Post('gps-review/:visitLogId/override')
  @Roles(UserRole.admin, UserRole.supervisor)
  async overrideGpsResult(
    @Param('visitLogId', ParseUUIDPipe) visitLogId: string,
    @Body() body: { reason: string },
    @CurrentUser() user: JwtUserPayload
  ) {
    return this.adminService.overrideGpsResult({
      visitLogId,
      actorUserId: user.sub,
      organizationId: await this.resolveOrganizationId(user),
      reason: body.reason
    });
  }

  @Post('sync-conflicts/:visitLogId/resolve')
  @Roles(UserRole.admin, UserRole.supervisor)
  async resolveSyncConflict(
    @Param('visitLogId', ParseUUIDPipe) visitLogId: string,
    @Body() body: ResolveSyncConflictDto,
    @CurrentUser() user: JwtUserPayload
  ) {
    return this.adminService.resolveSyncConflict({
      visitLogId,
      actorUserId: user.sub,
      organizationId: await this.resolveOrganizationId(user),
      reason: body.reason
    });
  }

  @Post('canvassers')
  async createCanvasser(
    @Body()
    body: { firstName: string; lastName: string; email: string; password: string; role?: UserRole },
    @CurrentUser() user: JwtUserPayload
  ) {
    return this.usersService.createCanvasser({
      ...body,
      organizationId: await this.resolveOrganizationId(user)
    });
  }

  @Post('canvassers/invite')
  async inviteCanvasser(@Body() body: InviteCanvasserDto, @CurrentUser() user: JwtUserPayload) {
    return this.authService.inviteCanvasser({
      ...body,
      organizationId: await this.resolveOrganizationId(user)
    });
  }

  @Patch('canvassers/:id')
  async updateCanvasser(
    @Param('id') id: string,
    @Body()
    body: Partial<{ firstName: string; lastName: string; email: string; password: string; isActive: boolean }>,
    @CurrentUser() user: JwtUserPayload
  ) {
    return this.usersService.updateCanvasser(id, {
      ...body,
      organizationId: await this.resolveOrganizationId(user)
    });
  }

  @Post('turfs/:id/reassign')
  @Roles(UserRole.admin, UserRole.supervisor)
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
      await this.resolveOrganizationId(user)
    );
  }

  @Post('turfs/:id/reopen')
  @Roles(UserRole.admin, UserRole.supervisor)
  async reopenTurf(
    @Param('id', ParseUUIDPipe) turfId: string,
    @Body() body: { reason?: string },
    @CurrentUser() user: JwtUserPayload
  ) {
    return this.turfsService.reopenTurf(turfId, user.sub, body.reason, await this.resolveOrganizationId(user));
  }
}
