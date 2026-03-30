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
    const defaultTeamId =
      scope.role === UserRole.supervisor || scope.role === UserRole.canvasser ? scope.teamId ?? undefined : undefined;
    const defaultRegionCode =
      scope.role === UserRole.supervisor && !scope.teamId ? scope.regionCode ?? undefined : undefined;

    return {
      ...query,
      organizationId: scope.organizationId,
      campaignId: query.campaignId ?? undefined,
      teamId: query.teamId ?? defaultTeamId,
      regionCode: query.regionCode ?? defaultRegionCode
    };
  }

  @Get('overview')
  @Roles(UserRole.admin, UserRole.supervisor)
  async overview(@CurrentUser() user: JwtUserPayload, @Query() query: ReportFiltersDto) {
    return this.reportsService.getOverview(await this.withScope(user, query));
  }

  @Get('productivity')
  @Roles(UserRole.admin, UserRole.supervisor)
  async productivity(@CurrentUser() user: JwtUserPayload, @Query() query: ReportFiltersDto) {
    return this.reportsService.getProductivity(await this.withScope(user, query));
  }

  @Get('gps-exceptions')
  @Roles(UserRole.admin, UserRole.supervisor)
  async gpsExceptions(@CurrentUser() user: JwtUserPayload, @Query() query: ReportFiltersDto) {
    return this.reportsService.getGpsExceptions(await this.withScope(user, query));
  }

  @Get('audit-activity')
  @Roles(UserRole.admin, UserRole.supervisor)
  async auditActivity(@CurrentUser() user: JwtUserPayload, @Query() query: ReportFiltersDto) {
    return this.reportsService.getAuditActivity(await this.withScope(user, query));
  }

  @Get('trends')
  @Roles(UserRole.admin, UserRole.supervisor)
  async trends(@CurrentUser() user: JwtUserPayload, @Query() query: ReportFiltersDto) {
    return this.reportsService.getTrendSummary(await this.withScope(user, query));
  }

  @Get('resolved-conflicts')
  @Roles(UserRole.admin, UserRole.supervisor)
  async resolvedConflicts(@CurrentUser() user: JwtUserPayload, @Query() query: ReportFiltersDto) {
    return this.reportsService.getResolvedConflicts(await this.withScope(user, query));
  }

  @Get('export-batches')
  @Roles(UserRole.admin, UserRole.supervisor)
  async exportBatches(@CurrentUser() user: JwtUserPayload, @Query() query: ReportFiltersDto) {
    return this.reportsService.getExportBatchAnalytics(await this.withScope(user, query));
  }

  @Get('my-performance')
  @Roles(UserRole.admin, UserRole.supervisor, UserRole.canvasser)
  async myPerformance(@CurrentUser() user: JwtUserPayload, @Query() query: ReportFiltersDto) {
    const filters = await this.withScope(user, query);
    const canvasserFilters = {
      ...filters,
      canvasserId: user.sub
    };

    const [overview, productivity, trends] = await Promise.all([
      this.reportsService.getOverview(canvasserFilters),
      this.reportsService.getProductivity(canvasserFilters),
      this.reportsService.getTrendSummary(canvasserFilters)
    ]);

    return {
      overview,
      productivity: productivity.rows[0] ?? null,
      trends
    };
  }
}
