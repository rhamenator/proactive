import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtUserPayload } from '../common/interfaces/jwt-user-payload.interface';
import { UsersService } from '../users/users.service';
import { AddressRequestsService } from './address-requests.service';
import { CreateAddressRequestDto } from './dto/create-address-request.dto';
import { ListAddressRequestsDto } from './dto/list-address-requests.dto';
import { ReviewAddressRequestDto } from './dto/review-address-request.dto';

@Controller('address-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AddressRequestsController {
  constructor(
    private readonly addressRequestsService: AddressRequestsService,
    private readonly usersService: UsersService
  ) {}

  private async resolveOrganizationId(user: JwtUserPayload) {
    if (user.organizationId !== undefined) {
      return user.organizationId ?? null;
    }

    const currentUser = await this.usersService.findById(user.sub);
    return currentUser.organizationId ?? null;
  }

  @Post()
  @Roles(UserRole.canvasser, UserRole.supervisor)
  async submitRequest(@CurrentUser() user: JwtUserPayload, @Body() body: CreateAddressRequestDto) {
    return this.addressRequestsService.submitRequest({
      actorUserId: user.sub,
      actorRole: user.role,
      organizationId: await this.resolveOrganizationId(user),
      ...body
    });
  }

  @Get('mine')
  @Roles(UserRole.canvasser, UserRole.supervisor)
  async listOwnRequests(@CurrentUser() user: JwtUserPayload, @Query() query: ListAddressRequestsDto) {
    return this.addressRequestsService.listOwnRequests({
      actorUserId: user.sub,
      actorRole: user.role,
      organizationId: await this.resolveOrganizationId(user),
      take: query.take
    });
  }

  @Get('review')
  @Roles(UserRole.admin, UserRole.supervisor)
  async reviewQueue(@CurrentUser() user: JwtUserPayload, @Query() query: ListAddressRequestsDto) {
    return this.addressRequestsService.reviewQueue({
      actorRole: user.role,
      organizationId: await this.resolveOrganizationId(user),
      status: query.status,
      take: query.take
    });
  }

  @Post(':id/approve')
  @Roles(UserRole.admin, UserRole.supervisor)
  async approveRequest(
    @Param('id', ParseUUIDPipe) requestId: string,
    @CurrentUser() user: JwtUserPayload,
    @Body() body: ReviewAddressRequestDto
  ) {
    return this.addressRequestsService.approveRequest({
      requestId,
      actorUserId: user.sub,
      actorRole: user.role,
      organizationId: await this.resolveOrganizationId(user),
      reason: body.reason
    });
  }

  @Post(':id/reject')
  @Roles(UserRole.admin, UserRole.supervisor)
  async rejectRequest(
    @Param('id', ParseUUIDPipe) requestId: string,
    @CurrentUser() user: JwtUserPayload,
    @Body() body: ReviewAddressRequestDto
  ) {
    return this.addressRequestsService.rejectRequest({
      requestId,
      actorUserId: user.sub,
      actorRole: user.role,
      organizationId: await this.resolveOrganizationId(user),
      reason: body.reason
    });
  }
}
