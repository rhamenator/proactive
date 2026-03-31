import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { CsvProfilesModule } from '../csv-profiles/csv-profiles.module';
import { PoliciesModule } from '../policies/policies.module';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersModule } from '../users/users.module';
import { ExportsController } from './exports.controller';
import { ExportsService } from './exports.service';

@Module({
  imports: [PrismaModule, AuditModule, PoliciesModule, CsvProfilesModule, UsersModule],
  controllers: [ExportsController],
  providers: [ExportsService]
})
export class ExportsModule {}
