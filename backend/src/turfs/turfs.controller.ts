import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireFreshMfa } from '../common/decorators/require-fresh-mfa.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { FreshMfaGuard } from '../common/guards/fresh-mfa.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtUserPayload } from '../common/interfaces/jwt-user-payload.interface';
import { resolveAccessScope } from '../common/utils/access-scope.util';
import { PoliciesService } from '../policies/policies.service';
import { UsersService } from '../users/users.service';
import { AssignTurfDto } from './dto/assign-turf.dto';
import { CreateTurfDto } from './dto/create-turf.dto';
import { TurfSessionActionDto } from './dto/turf-session-action.dto';
import { TurfsService } from './turfs.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class TurfsController {
  constructor(
    private readonly turfsService: TurfsService,
    private readonly usersService: UsersService,
    private readonly policiesService: PoliciesService
  ) {}

  private async resolveScope(user: JwtUserPayload) {
    return resolveAccessScope(user, this.usersService, this.policiesService);
  }

  @Get('turfs')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin, UserRole.supervisor)
  async listTurfs(@CurrentUser() user: JwtUserPayload) {
    return this.turfsService.listTurfs(await this.resolveScope(user));
  }

  @Post('turfs')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin)
  createTurf(@Body() body: CreateTurfDto, @CurrentUser() user: JwtUserPayload) {
    return this.turfsService.createTurf(body, user.sub);
  }

  @Post('turfs/:id/scope')
  @UseGuards(RolesGuard, FreshMfaGuard)
  @Roles(UserRole.admin)
  @RequireFreshMfa()
  async updateTurfScope(
    @Param('id', ParseUUIDPipe) turfId: string,
    @Body() body: { teamId?: string | null; regionCode?: string | null },
    @CurrentUser() user: JwtUserPayload
  ) {
    return this.turfsService.updateTurfScope(turfId, body, user.sub, await this.resolveScope(user));
  }

  @Post('turfs/:id/assign')
  @UseGuards(RolesGuard, FreshMfaGuard)
  @Roles(UserRole.admin, UserRole.supervisor)
  @RequireFreshMfa()
  async assignTurf(
    @Param('id', ParseUUIDPipe) turfId: string,
    @Body() body: AssignTurfDto,
    @CurrentUser() user: JwtUserPayload
  ) {
    return this.turfsService.assignTurf(turfId, body.canvasserId, user.sub, undefined, await this.resolveScope(user));
  }

  @Get('turfs/:id/addresses')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin, UserRole.supervisor)
  async getAddresses(@Param('id', ParseUUIDPipe) turfId: string, @CurrentUser() user: JwtUserPayload) {
    return this.turfsService.getTurfAddresses(turfId, await this.resolveScope(user));
  }

  @Get('my-turf')
  @UseGuards(RolesGuard)
  @Roles(UserRole.canvasser)
  getMyTurf(@CurrentUser() user: JwtUserPayload) {
    return this.turfsService.getMyTurf(user.sub);
  }

  @Post('turf/start')
  @UseGuards(RolesGuard)
  @Roles(UserRole.canvasser)
  async startTurf(@Body() body: TurfSessionActionDto, @CurrentUser() user: JwtUserPayload) {
    return this.turfsService.startSession({
      canvasserId: user.sub,
      turfId: body.turfId,
      latitude: body.latitude,
      longitude: body.longitude
    });
  }

  @Post('turf/pause')
  @UseGuards(RolesGuard)
  @Roles(UserRole.canvasser)
  pauseTurf(@Body() body: TurfSessionActionDto, @CurrentUser() user: JwtUserPayload) {
    return this.turfsService.pauseSession({
      canvasserId: user.sub,
      turfId: body.turfId,
      latitude: body.latitude,
      longitude: body.longitude
    });
  }

  @Post('turf/resume')
  @UseGuards(RolesGuard)
  @Roles(UserRole.canvasser)
  resumeTurf(@Body() body: TurfSessionActionDto, @CurrentUser() user: JwtUserPayload) {
    return this.turfsService.resumeSession({
      canvasserId: user.sub,
      turfId: body.turfId,
      latitude: body.latitude,
      longitude: body.longitude
    });
  }

  @Post('turf/complete')
  @UseGuards(RolesGuard)
  @Roles(UserRole.canvasser)
  completeTurf(@Body() body: TurfSessionActionDto, @CurrentUser() user: JwtUserPayload) {
    return this.turfsService.completeSession({
      canvasserId: user.sub,
      turfId: body.turfId,
      latitude: body.latitude,
      longitude: body.longitude
    });
  }

  @Post('turf/end')
  @UseGuards(RolesGuard)
  @Roles(UserRole.canvasser)
  endTurf(@Body() body: TurfSessionActionDto, @CurrentUser() user: JwtUserPayload) {
    return this.turfsService.completeSession({
      canvasserId: user.sub,
      turfId: body.turfId,
      latitude: body.latitude,
      longitude: body.longitude
    });
  }
}
