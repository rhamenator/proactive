import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
import { RetentionService } from './retention.service';

@Module({
  imports: [PrismaModule, AuditModule, SystemSettingsModule],
  providers: [RetentionService],
  exports: [RetentionService]
})
export class RetentionModule {}
