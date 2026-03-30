import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtUserPayload } from '../common/interfaces/jwt-user-payload.interface';
import { UsersService } from '../users/users.service';
import { CorrectVisitDto } from './dto/correct-visit.dto';
import { CreateVisitDto } from './dto/create-visit.dto';
import { VisitsService } from './visits.service';

@Controller('visits')
@UseGuards(JwtAuthGuard)
export class VisitsController {
  constructor(
    private readonly visitsService: VisitsService,
    private readonly usersService: UsersService
  ) {}

  private async resolveOrganizationId(user: JwtUserPayload) {
    if (user.organizationId !== undefined) {
      return user.organizationId ?? null;
    }

    const currentUser = await this.usersService.findById(user.sub);
    return currentUser.organizationId ?? null;
  }

  @Get('outcomes')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin, UserRole.supervisor, UserRole.canvasser)
  async listActiveOutcomes(@CurrentUser() user: JwtUserPayload) {
    return this.visitsService.listActiveOutcomes(await this.resolveOrganizationId(user));
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
      organizationId: await this.resolveOrganizationId(user),
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
      organizationId: await this.resolveOrganizationId(user),
      outcomeCode: body.outcomeCode,
      notes: body.notes,
      reason: body.reason
    });
  }
}
