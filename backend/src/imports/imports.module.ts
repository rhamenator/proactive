import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule, AuditModule],
  controllers: [ImportsController],
  providers: [ImportsService],
  exports: [ImportsService]
})
export class ImportsModule {}
