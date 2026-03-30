import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PoliciesModule } from '../policies/policies.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ExportsController } from './exports.controller';
import { ExportsService } from './exports.service';

@Module({
  imports: [PrismaModule, AuditModule, PoliciesModule],
  controllers: [ExportsController],
  providers: [ExportsService]
})
export class ExportsModule {}
