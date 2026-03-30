import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersModule } from '../users/users.module';
import { AddressRequestsController } from './address-requests.controller';
import { AddressRequestsService } from './address-requests.service';

@Module({
  imports: [PrismaModule, AuditModule, UsersModule],
  controllers: [AddressRequestsController],
  providers: [AddressRequestsService],
  exports: [AddressRequestsService]
})
export class AddressRequestsModule {}
