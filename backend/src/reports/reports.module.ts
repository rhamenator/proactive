import { Module } from '@nestjs/common';
import { PoliciesModule } from '../policies/policies.module';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersModule } from '../users/users.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [PrismaModule, UsersModule, PoliciesModule],
  controllers: [ReportsController],
  providers: [ReportsService]
})
export class ReportsModule {}
