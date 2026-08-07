import { Body, Controller, Get, Post, UnauthorizedException, UseGuards } from '@nestjs/common';
import { UserRole } from '../../generated/prisma/client.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import type { JwtUserPayload } from '../common/interfaces/jwt-user-payload.interface.js';
import { ActivateAccountDto } from './dto/activate-account.dto.js';
import { CompletePasswordResetDto } from './dto/complete-password-reset.dto.js';
import { DisableMfaDto } from './dto/disable-mfa.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { MfaChallengeDto } from './dto/mfa-challenge.dto.js';
import { MfaCodeDto } from './dto/mfa-code.dto.js';
import { MfaStepUpDto } from './dto/mfa-step-up.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto.js';
import { StartImpersonationDto } from './dto/start-impersonation.dto.js';
import { StopImpersonationDto } from './dto/stop-impersonation.dto.js';
import { AuthService } from './auth.service.js';
import { UsersService } from '../users/users.service.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService
  ) {}

  @Post('login')
  login(@Body() body: LoginDto) {
    return this.authService.login(body.email, body.password);
  }

  @Post('refresh')
  refresh(@Body() body: RefreshTokenDto) {
    return this.authService.refresh(body.refreshToken);
  }

  @Post('logout')
  logout(@Body() body: RefreshTokenDto) {
    return this.authService.logout(body.refreshToken);
  }

  @Post('password-reset/request')
  requestPasswordReset(@Body() body: RequestPasswordResetDto) {
    return this.authService.requestPasswordReset(body.email);
  }

  @Post('password-reset/confirm')
  confirmPasswordReset(@Body() body: CompletePasswordResetDto) {
    return this.authService.completePasswordReset(body.token, body.password);
  }

  @Post('activate')
  activate(@Body() body: ActivateAccountDto) {
    return this.authService.activateAccount(body.token, body.password);
  }

  @Post('mfa/setup/init')
  mfaSetupInit(@Body() body: MfaChallengeDto) {
    return this.authService.initializeMfaSetup(body.challengeToken);
  }

  @Post('mfa/setup/complete')
  mfaSetupComplete(@Body() body: MfaCodeDto) {
    return this.authService.completeMfaSetup(body.challengeToken, body.code);
  }

  @Post('mfa/verify')
  mfaVerify(@Body() body: MfaCodeDto) {
    return this.authService.verifyMfaChallenge(body.challengeToken, body.code);
  }

  @Get('mfa/status')
  @UseGuards(JwtAuthGuard)
  mfaStatus(@CurrentUser() user: JwtUserPayload) {
    return this.authService.mfaStatus(user.sub);
  }

  @Post('mfa/disable')
  @UseGuards(JwtAuthGuard)
  mfaDisable(@CurrentUser() user: JwtUserPayload, @Body() body: DisableMfaDto) {
    return this.authService.disableMfa(user.sub, body.password, body.code);
  }

  @Post('mfa/step-up')
  @UseGuards(JwtAuthGuard)
  mfaStepUp(@CurrentUser() user: JwtUserPayload, @Body() body: MfaStepUpDto) {
    return this.authService.stepUpMfa(user, body.code);
  }

  @Get('impersonation/active')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin)
  activeImpersonation(@CurrentUser() user: JwtUserPayload) {
    return this.authService.getActiveImpersonation(user.sub);
  }

  @Post('impersonation/start')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin)
  startImpersonation(@CurrentUser() user: JwtUserPayload, @Body() body: StartImpersonationDto) {
    return this.authService.startImpersonation(user.sub, body.targetUserId, body.reason);
  }

  @Post('impersonation/stop')
  @UseGuards(JwtAuthGuard)
  stopImpersonation(@CurrentUser() user: JwtUserPayload, @Body() body: StopImpersonationDto) {
    const sessionId = body.sessionId ?? user.impersonationSessionId;
    const actorUserId = user.impersonatorUserId ?? user.sub;

    if (!sessionId) {
      throw new UnauthorizedException('No active impersonation session was provided');
    }

    return this.authService.stopImpersonation(actorUserId, sessionId);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: JwtUserPayload) {
    const value = await this.usersService.findById(user.sub);
    return this.usersService.sanitize(value);
  }
}
