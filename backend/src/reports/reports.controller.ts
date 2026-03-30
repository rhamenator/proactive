import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtUserPayload } from '../common/interfaces/jwt-user-payload.interface';
import { resolveAccessScope } from '../common/utils/access-scope.util';
import { PoliciesService } from '../policies/policies.service';
import { UsersService } from '../users/users.service';
import { ReportFiltersDto } from './dto/report-filters.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.admin, UserRole.supervisor)
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly usersService: UsersService,
    private readonly policiesService: PoliciesService
  ) {}

  private async withScope(user: JwtUserPayload, query: ReportFiltersDto) {
    const scope = await resolveAccessScope(user, this.usersService, this.policiesService);
    return {
      ...query,
      organizationId: scope.organizationId,
      campaignId: query.campaignId ?? scope.campaignId ?? undefined,
      teamId: query.teamId ?? (scope.role === UserRole.supervisor && scope.supervisorScopeMode === 'team' ? scope.teamId ?? undefined : undefined),
      regionCode: query.regionCode ?? (scope.role === UserRole.supervisor && scope.supervisorScopeMode === 'region' ? scope.regionCode ?? undefined : undefined)
    };
  }

  @Get('overview')
  async overview(@CurrentUser() user: JwtUserPayload, @Query() query: ReportFiltersDto) {
    return this.reportsService.getOverview(await this.withScope(user, query));
  }

  @Get('productivity')
  async productivity(@CurrentUser() user: JwtUserPayload, @Query() query: ReportFiltersDto) {
    return this.reportsService.getProductivity(await this.withScope(user, query));
  }

  @Get('gps-exceptions')
  async gpsExceptions(@CurrentUser() user: JwtUserPayload, @Query() query: ReportFiltersDto) {
    return this.reportsService.getGpsExceptions(await this.withScope(user, query));
  }

  @Get('audit-activity')
  async auditActivity(@CurrentUser() user: JwtUserPayload, @Query() query: ReportFiltersDto) {
    return this.reportsService.getAuditActivity(await this.withScope(user, query));
  }

  @Get('trends')
  async trends(@CurrentUser() user: JwtUserPayload, @Query() query: ReportFiltersDto) {
    return this.reportsService.getTrendSummary(await this.withScope(user, query));
  }

  @Get('resolved-conflicts')
  async resolvedConflicts(@CurrentUser() user: JwtUserPayload, @Query() query: ReportFiltersDto) {
    return this.reportsService.getResolvedConflicts(await this.withScope(user, query));
  }

  @Get('export-batches')
  async exportBatches(@CurrentUser() user: JwtUserPayload, @Query() query: ReportFiltersDto) {
    return this.reportsService.getExportBatchAnalytics(await this.withScope(user, query));
  }
}
