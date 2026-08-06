import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { UserRole } from '../../generated/prisma/client.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequireFreshMfa } from '../common/decorators/require-fresh-mfa.decorator.js';
import { FreshMfaGuard } from '../common/guards/fresh-mfa.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import type { JwtUserPayload } from '../common/interfaces/jwt-user-payload.interface.js';
import { resolveAccessScope } from '../common/utils/access-scope.util.js';
import { PoliciesService } from '../policies/policies.service.js';
import { UsersService } from '../users/users.service.js';
import { ExportsService } from './exports.service.js';

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
    @Query('profileCode') profileCode?: string,
    @CurrentUser() user?: JwtUserPayload,
    @Res() response?: Response
  ) {
    const scope = user ? await resolveAccessScope(user, this.usersService, this.policiesService) : { organizationId: null, campaignId: null };
    const result = await this.exportsService.vanResultsCsv({
      turfId,
      markExported: markExported === 'true',
      profileCode,
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
    @Query('profileCode') profileCode?: string,
    @CurrentUser() user?: JwtUserPayload,
    @Res() response?: Response
  ) {
    const scope = user ? await resolveAccessScope(user, this.usersService, this.policiesService) : { organizationId: null, campaignId: null };
    const result = await this.exportsService.internalMasterCsv({
      turfId,
      profileCode,
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
