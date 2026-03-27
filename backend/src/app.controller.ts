import { Controller, Get, UseGuards } from '@nestjs/common';
import { AppService } from './app.service';
import { CurrentUser } from './common/decorators/current-user.decorator';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { JwtUserPayload } from './common/interfaces/jwt-user-payload.interface';
import { UsersService } from './users/users.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly usersService: UsersService
  ) {}

  @Get()
  getHealth() {
    return this.appService.getHealth();
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@CurrentUser() user: JwtUserPayload) {
    const value = await this.usersService.findById(user.sub);
    return this.usersService.sanitize(value);
  }
}
