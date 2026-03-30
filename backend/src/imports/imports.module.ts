import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { CsvProfilesModule } from '../csv-profiles/csv-profiles.module';
import { PoliciesModule } from '../policies/policies.module';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule, AuditModule, PoliciesModule, CsvProfilesModule],
  controllers: [ImportsController],
  providers: [ImportsService],
  exports: [ImportsService]
})
export class ImportsModule {}
