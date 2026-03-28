import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthService } from '../auth/auth.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtUserPayload } from '../common/interfaces/jwt-user-payload.interface';
import { TurfsService } from '../turfs/turfs.service';
import { UsersService } from '../users/users.service';
import { InviteCanvasserDto } from './dto/invite-canvasser.dto';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.admin)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
    private readonly turfsService: TurfsService
  ) {}

  @Get('dashboard-summary')
  @Roles(UserRole.admin, UserRole.supervisor)
  dashboardSummary() {
    return this.adminService.dashboardSummary();
  }

  @Get('active-canvassers')
  @Roles(UserRole.admin, UserRole.supervisor)
  activeCanvassers() {
    return this.adminService.activeCanvassers();
  }

  @Get('canvassers')
  @Roles(UserRole.admin, UserRole.supervisor)
  listCanvassers() {
    return this.adminService.listCanvassers();
  }

  @Post('canvassers')
  createCanvasser(
    @Body()
    body: { firstName: string; lastName: string; email: string; password: string; role?: UserRole }
  ) {
    return this.usersService.createCanvasser(body);
  }

  @Post('canvassers/invite')
  inviteCanvasser(@Body() body: InviteCanvasserDto) {
    return this.authService.inviteCanvasser(body);
  }

  @Patch('canvassers/:id')
  updateCanvasser(
    @Param('id') id: string,
    @Body()
    body: Partial<{ firstName: string; lastName: string; email: string; password: string; isActive: boolean }>
  ) {
    return this.usersService.updateCanvasser(id, body);
  }

  @Post('turfs/:id/reassign')
  @Roles(UserRole.admin, UserRole.supervisor)
  reassignTurf(
    @Param('id', ParseUUIDPipe) turfId: string,
    @Body() body: { canvasserId: string; reason?: string },
    @CurrentUser() user: JwtUserPayload
  ) {
    return this.turfsService.assignTurf(turfId, body.canvasserId, user.sub, body.reason);
  }

  @Post('turfs/:id/reopen')
  @Roles(UserRole.admin, UserRole.supervisor)
  reopenTurf(
    @Param('id', ParseUUIDPipe) turfId: string,
    @Body() body: { reason?: string },
    @CurrentUser() user: JwtUserPayload
  ) {
    return this.turfsService.reopenTurf(turfId, user.sub, body.reason);
  }
}
