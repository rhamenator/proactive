import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { PoliciesModule } from '../policies/policies.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { RecoveryController } from './recovery.controller.js';
import { RecoveryService } from './recovery.service.js';

@Module({
  imports: [PrismaModule, AuditModule, PoliciesModule],
  controllers: [RecoveryController],
  providers: [RecoveryService]
})
export class RecoveryModule {}
