import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { CsvProfilesModule } from '../csv-profiles/csv-profiles.module.js';
import { PoliciesModule } from '../policies/policies.module.js';
import { ImportsController } from './imports.controller.js';
import { ImportsService } from './imports.service.js';
import { UsersModule } from '../users/users.module.js';

@Module({
  imports: [UsersModule, AuditModule, PoliciesModule, CsvProfilesModule],
  controllers: [ImportsController],
  providers: [ImportsService],
  exports: [ImportsService]
})
export class ImportsModule {}
