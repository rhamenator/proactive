import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { ImportsModule } from '../imports/imports.module.js';
import { PoliciesModule } from '../policies/policies.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { UsersModule } from '../users/users.module.js';
import { TurfsController } from './turfs.controller.js';
import { TurfsService } from './turfs.service.js';

@Module({
  imports: [PrismaModule, UsersModule, AuditModule, ImportsModule, PoliciesModule],
  controllers: [TurfsController],
  providers: [TurfsService],
  exports: [TurfsService]
})
export class TurfsModule {}
