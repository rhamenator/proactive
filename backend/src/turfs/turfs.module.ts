import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersModule } from '../users/users.module';
import { TurfsController } from './turfs.controller';
import { TurfsService } from './turfs.service';

@Module({
  imports: [PrismaModule, UsersModule, AuditModule],
  controllers: [TurfsController],
  providers: [TurfsService],
  exports: [TurfsService]
})
export class TurfsModule {}
