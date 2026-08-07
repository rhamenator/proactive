import { Global, Module } from '@nestjs/common';
import { JwtModule, type JwtModuleOptions } from '@nestjs/jwt';
import { FreshMfaGuard } from '../common/guards/fresh-mfa.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { getRequiredEnv } from '../common/utils/env.util.js';
import { PoliciesModule } from '../policies/policies.module.js';

@Global()
@Module({
  imports: [
    PoliciesModule,
    JwtModule.register({
      secret: getRequiredEnv('JWT_SECRET'),
      signOptions: {
        expiresIn: (process.env.JWT_EXPIRES_IN ?? '30m') as NonNullable<
          JwtModuleOptions['signOptions']
        >['expiresIn']
      }
    })
  ],
  providers: [JwtAuthGuard, RolesGuard, FreshMfaGuard],
  exports: [JwtModule, JwtAuthGuard, RolesGuard, FreshMfaGuard]
})
export class SecurityModule {}
