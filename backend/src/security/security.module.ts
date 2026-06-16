import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { FreshMfaGuard } from '../common/guards/fresh-mfa.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PoliciesModule } from '../policies/policies.module';
import { getJwtSecret } from './jwt-secret.util';

@Global()
@Module({
  imports: [
    PoliciesModule,
    JwtModule.register({
      secret: getJwtSecret(),
      signOptions: {
        expiresIn: (process.env.JWT_EXPIRES_IN ?? '30m') as any
      }
    })
  ],
  providers: [JwtAuthGuard, RolesGuard, FreshMfaGuard],
  exports: [JwtModule, JwtAuthGuard, RolesGuard, FreshMfaGuard]
})
export class SecurityModule {}
