import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { SystemSettingsModule } from '../system-settings/system-settings.module.js';
import { RetentionService } from './retention.service.js';

@Module({
  imports: [PrismaModule, AuditModule, SystemSettingsModule],
  providers: [RetentionService],
  exports: [RetentionService]
})
export class RetentionModule {}
