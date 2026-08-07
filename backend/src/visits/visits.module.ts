import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { PoliciesModule } from '../policies/policies.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { UsersModule } from '../users/users.module.js';
import { VisitsController } from './visits.controller.js';
import { VisitsService } from './visits.service.js';

@Module({
  imports: [PrismaModule, AuditModule, UsersModule, PoliciesModule],
  controllers: [VisitsController],
  providers: [VisitsService]
})
export class VisitsModule {}
