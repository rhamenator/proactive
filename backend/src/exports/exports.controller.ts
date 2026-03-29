import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtUserPayload } from '../common/interfaces/jwt-user-payload.interface';
import { UsersService } from '../users/users.service';
import { ExportsService } from './exports.service';

@Controller('exports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.admin)
export class ExportsController {
  constructor(
    private readonly exportsService: ExportsService,
    private readonly usersService: UsersService
  ) {}

  private async resolveOrganizationId(user: JwtUserPayload) {
    if (user.organizationId !== undefined) {
      return user.organizationId ?? null;
    }

    const currentUser = await this.usersService.findById(user.sub);
    return currentUser.organizationId ?? null;
  }

  @Get('history')
  async exportHistory(@CurrentUser() user: JwtUserPayload) {
    return this.exportsService.exportHistory(await this.resolveOrganizationId(user));
  }

  @Get('van-results')
  async vanResultsCsv(
    @Query('turfId') turfId?: string,
    @Query('markExported') markExported?: string,
    @CurrentUser() user?: JwtUserPayload,
    @Res() response?: Response
  ) {
    const result = await this.exportsService.vanResultsCsv({
      turfId,
      markExported: markExported === 'true',
      actorUserId: user?.sub,
      organizationId: user ? await this.resolveOrganizationId(user) : null
    });

    if (!response) {
      return result;
    }

    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    return response.send(result.csv);
  }

  @Get('internal-master')
  async internalMasterCsv(
    @Query('turfId') turfId?: string,
    @CurrentUser() user?: JwtUserPayload,
    @Res() response?: Response
  ) {
    const result = await this.exportsService.internalMasterCsv({
      turfId,
      actorUserId: user?.sub,
      organizationId: user ? await this.resolveOrganizationId(user) : null
    });

    if (!response) {
      return result;
    }

    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    return response.send(result.csv);
  }
}
