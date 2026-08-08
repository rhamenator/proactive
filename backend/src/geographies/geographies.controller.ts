import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { GeographyNodeKind, UserRole } from '../../generated/prisma/client.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequireFreshMfa } from '../common/decorators/require-fresh-mfa.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { FreshMfaGuard } from '../common/guards/fresh-mfa.guard.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import type { JwtUserPayload } from '../common/interfaces/jwt-user-payload.interface.js';
import { resolveAccessScope } from '../common/utils/access-scope.util.js';
import { PoliciesService } from '../policies/policies.service.js';
import { UsersService } from '../users/users.service.js';
import { GeographiesService, type GeographyNodeInput } from './geographies.service.js';

@Controller('admin/geographies')
@UseGuards(JwtAuthGuard, RolesGuard, FreshMfaGuard)
@Roles(UserRole.admin, UserRole.supervisor)
export class GeographiesController {
  constructor(
    private readonly geographies: GeographiesService,
    private readonly users: UsersService,
    private readonly policies: PoliciesService
  ) {}

  private scope(user: JwtUserPayload) {
    return resolveAccessScope(user, this.users, this.policies);
  }

  @Get()
  async list(
    @CurrentUser() user: JwtUserPayload,
    @Query('parentId') parentId?: string,
    @Query('kind') kind?: GeographyNodeKind,
    @Query('includeInactive') includeInactive?: string
  ) {
    return this.geographies.list(await this.scope(user), {
      ...(parentId !== undefined ? { parentId: parentId || null } : {}),
      kind,
      includeInactive: includeInactive === 'true'
    });
  }

  @Get(':id/reporting-filter')
  async reportingFilter(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtUserPayload) {
    return this.geographies.reportingFilter(await this.scope(user), id);
  }

  @Post()
  @Roles(UserRole.admin)
  @RequireFreshMfa()
  async create(@Body() body: GeographyNodeInput, @CurrentUser() user: JwtUserPayload) {
    return this.geographies.create(await this.scope(user), body, user.sub);
  }

  @Patch(':id')
  @Roles(UserRole.admin)
  @RequireFreshMfa()
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Partial<Omit<GeographyNodeInput, 'externalId'>> & { reason?: string },
    @CurrentUser() user: JwtUserPayload
  ) {
    const { reason, ...input } = body;
    return this.geographies.update(await this.scope(user), id, input, user.sub, reason);
  }

  @Put(':id/users/:userId')
  @Roles(UserRole.admin)
  @RequireFreshMfa()
  async assignUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: { reason: string },
    @CurrentUser() user: JwtUserPayload
  ) {
    return this.geographies.assignUser(await this.scope(user), id, userId, user.sub, body.reason);
  }
}
