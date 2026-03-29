import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { JwtUserPayload } from '../common/interfaces/jwt-user-payload.interface';
import { ActivateAccountDto } from './dto/activate-account.dto';
import { CompletePasswordResetDto } from './dto/complete-password-reset.dto';
import { DisableMfaDto } from './dto/disable-mfa.dto';
import { LoginDto } from './dto/login.dto';
import { MfaChallengeDto } from './dto/mfa-challenge.dto';
import { MfaCodeDto } from './dto/mfa-code.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

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

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: JwtUserPayload) {
    const value = await this.usersService.findById(user.sub);
    return this.usersService.sanitize(value);
  }
}
