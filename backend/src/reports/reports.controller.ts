import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtUserPayload } from '../common/interfaces/jwt-user-payload.interface';
import { UsersService } from '../users/users.service';
import { ReportFiltersDto } from './dto/report-filters.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.admin, UserRole.supervisor)
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly usersService: UsersService
  ) {}

  private async resolveOrganizationId(user: JwtUserPayload) {
    if (user.organizationId !== undefined) {
      return user.organizationId ?? null;
    }

    const currentUser = await this.usersService.findById(user.sub);
    return currentUser.organizationId ?? null;
  }

  private async withScope(user: JwtUserPayload, query: ReportFiltersDto) {
    return {
      organizationId: await this.resolveOrganizationId(user),
      ...query
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
}
