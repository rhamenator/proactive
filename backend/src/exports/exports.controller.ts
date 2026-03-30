import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireFreshMfa } from '../common/decorators/require-fresh-mfa.decorator';
import { FreshMfaGuard } from '../common/guards/fresh-mfa.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtUserPayload } from '../common/interfaces/jwt-user-payload.interface';
import { resolveAccessScope } from '../common/utils/access-scope.util';
import { PoliciesService } from '../policies/policies.service';
import { UsersService } from '../users/users.service';
import { ExportsService } from './exports.service';

@Controller('exports')
@UseGuards(JwtAuthGuard, RolesGuard, FreshMfaGuard)
@Roles(UserRole.admin)
export class ExportsController {
  constructor(
    private readonly exportsService: ExportsService,
    private readonly usersService: UsersService,
    private readonly policiesService: PoliciesService
  ) {}

  @Get('history')
  async exportHistory(@CurrentUser() user: JwtUserPayload) {
    return this.exportsService.exportHistory(await resolveAccessScope(user, this.usersService, this.policiesService));
  }

  @Get('history/:id/download')
  @RequireFreshMfa()
  async downloadExportBatch(
    @Param('id') batchId: string,
    @CurrentUser() user: JwtUserPayload,
    @Res() response: Response
  ) {
    const result = await this.exportsService.downloadExportBatch(batchId, await resolveAccessScope(user, this.usersService, this.policiesService));
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    return response.send(result.csv);
  }

  @Get('van-results')
  @RequireFreshMfa()
  async vanResultsCsv(
    @Query('turfId') turfId?: string,
    @Query('markExported') markExported?: string,
    @CurrentUser() user?: JwtUserPayload,
    @Res() response?: Response
  ) {
    const scope = user ? await resolveAccessScope(user, this.usersService, this.policiesService) : { organizationId: null, campaignId: null };
    const result = await this.exportsService.vanResultsCsv({
      turfId,
      markExported: markExported === 'true',
      actorUserId: user?.sub,
      organizationId: scope.organizationId,
      campaignId: scope.campaignId
    });

    if (!response) {
      return result;
    }

    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    return response.send(result.csv);
  }

  @Get('internal-master')
  @RequireFreshMfa()
  async internalMasterCsv(
    @Query('turfId') turfId?: string,
    @CurrentUser() user?: JwtUserPayload,
    @Res() response?: Response
  ) {
    const scope = user ? await resolveAccessScope(user, this.usersService, this.policiesService) : { organizationId: null, campaignId: null };
    const result = await this.exportsService.internalMasterCsv({
      turfId,
      actorUserId: user?.sub,
      organizationId: scope.organizationId,
      campaignId: scope.campaignId
    });

    if (!response) {
      return result;
    }

    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    return response.send(result.csv);
  }
}
