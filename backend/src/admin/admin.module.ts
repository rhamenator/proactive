import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { CsvProfilesModule } from '../csv-profiles/csv-profiles.module.js';
import { PoliciesModule } from '../policies/policies.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { RetentionModule } from '../retention/retention.module.js';
import { SystemSettingsModule } from '../system-settings/system-settings.module.js';
import { TurfsModule } from '../turfs/turfs.module.js';
import { UsersModule } from '../users/users.module.js';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';

@Module({
  imports: [PrismaModule, UsersModule, AuthModule, TurfsModule, PoliciesModule, CsvProfilesModule, AuditModule, RetentionModule, SystemSettingsModule],
  controllers: [AdminController],
  providers: [AdminService]
})
export class AdminModule {}
