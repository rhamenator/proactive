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
    const safeUser = this.usersService.sanitize(value);

    if (!user.impersonationSessionId || !user.impersonatorUserId) {
      return safeUser;
    }

    return {
      ...safeUser,
      impersonation: {
        sessionId: user.impersonationSessionId,
        actorUserId: user.impersonatorUserId,
        actorEmail: user.impersonatorEmail ?? null,
        actorRole: user.impersonatorRole ?? null,
        actorName: user.impersonatorName ?? null,
        startedAt: user.impersonationStartedAt ?? null,
        reasonText: user.impersonationReasonText ?? null
      }
    };
  }
}
