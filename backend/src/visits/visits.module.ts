import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PoliciesModule } from '../policies/policies.module';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersModule } from '../users/users.module';
import { VisitsController } from './visits.controller';
import { VisitsService } from './visits.service';

@Module({
  imports: [PrismaModule, AuditModule, UsersModule, PoliciesModule],
  controllers: [VisitsController],
  providers: [VisitsService]
})
export class VisitsModule {}
