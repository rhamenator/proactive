import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { UsersModule } from '../users/users.module.js';
import { AddressRequestsController } from './address-requests.controller.js';
import { AddressRequestsService } from './address-requests.service.js';

@Module({
  imports: [PrismaModule, AuditModule, UsersModule],
  controllers: [AddressRequestsController],
  providers: [AddressRequestsService],
  exports: [AddressRequestsService]
})
export class AddressRequestsModule {}
