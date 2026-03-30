import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { FreshMfaGuard } from '../common/guards/fresh-mfa.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Global()
@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-secret',
      signOptions: {
        expiresIn: (process.env.JWT_EXPIRES_IN ?? '30m') as any
      }
    })
  ],
  providers: [JwtAuthGuard, RolesGuard, FreshMfaGuard],
  exports: [JwtModule, JwtAuthGuard, RolesGuard, FreshMfaGuard]
})
export class SecurityModule {}
