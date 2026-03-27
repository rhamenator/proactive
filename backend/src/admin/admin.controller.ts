import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtUserPayload } from '../common/interfaces/jwt-user-payload.interface';
import { UsersService } from '../users/users.service';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.admin)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly usersService: UsersService
  ) {}

  @Get('dashboard-summary')
  dashboardSummary() {
    return this.adminService.dashboardSummary();
  }

  @Get('active-canvassers')
  activeCanvassers() {
    return this.adminService.activeCanvassers();
  }

  @Get('canvassers')
  listCanvassers() {
    return this.adminService.listCanvassers();
  }

  @Post('canvassers')
  createCanvasser(
    @Body()
    body: { firstName: string; lastName: string; email: string; password: string }
  ) {
    return this.usersService.createCanvasser(body);
  }

  @Patch('canvassers/:id')
  updateCanvasser(
    @Param('id') id: string,
    @Body()
    body: Partial<{ firstName: string; lastName: string; email: string; password: string; isActive: boolean }>
  ) {
    return this.usersService.updateCanvasser(id, body);
  }
}
