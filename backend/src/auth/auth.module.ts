import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { PoliciesModule } from '../policies/policies.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { SecurityModule } from '../security/security.module.js';
import { SystemSettingsModule } from '../system-settings/system-settings.module.js';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

@Module({
  imports: [PrismaModule, SecurityModule, UsersModule, PoliciesModule, SystemSettingsModule, AuditModule],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService]
})
export class AuthModule {}
