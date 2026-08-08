import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { PoliciesModule } from '../policies/policies.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { UsersModule } from '../users/users.module.js';
import { GeographiesController } from './geographies.controller.js';
import { GeographiesService } from './geographies.service.js';

@Module({
  imports: [PrismaModule, AuditModule, UsersModule, PoliciesModule],
  controllers: [GeographiesController],
  providers: [GeographiesService],
  exports: [GeographiesService]
})
export class GeographiesModule {}
