import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PoliciesModule } from '../policies/policies.module';
import { PrismaModule } from '../prisma/prisma.module';
import { TurfsModule } from '../turfs/turfs.module';
import { UsersModule } from '../users/users.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [PrismaModule, UsersModule, AuthModule, TurfsModule, PoliciesModule],
  controllers: [AdminController],
  providers: [AdminService]
})
export class AdminModule {}
