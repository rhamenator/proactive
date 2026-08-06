import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { CsvProfilesModule } from '../csv-profiles/csv-profiles.module.js';
import { PoliciesModule } from '../policies/policies.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { UsersModule } from '../users/users.module.js';
import { ExportsController } from './exports.controller.js';
import { ExportsService } from './exports.service.js';

@Module({
  imports: [PrismaModule, AuditModule, PoliciesModule, CsvProfilesModule, UsersModule],
  controllers: [ExportsController],
  providers: [ExportsService]
})
export class ExportsModule {}
