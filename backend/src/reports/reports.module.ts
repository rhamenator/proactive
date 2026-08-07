import { Module } from '@nestjs/common';
import { PoliciesModule } from '../policies/policies.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { UsersModule } from '../users/users.module.js';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';

@Module({
  imports: [PrismaModule, UsersModule, PoliciesModule],
  controllers: [ReportsController],
  providers: [ReportsService]
})
export class ReportsModule {}
