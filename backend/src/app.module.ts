import { Module } from '@nestjs/common';
import { AdminModule } from './admin/admin.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ExportsModule } from './exports/exports.module';
import { ImportsModule } from './imports/imports.module';
import { PrismaModule } from './prisma/prisma.module';
import { SecurityModule } from './security/security.module';
import { TurfsModule } from './turfs/turfs.module';
import { UsersModule } from './users/users.module';
import { VisitsModule } from './visits/visits.module';

@Module({
  imports: [
    PrismaModule,
    SecurityModule,
    UsersModule,
    AuthModule,
    TurfsModule,
    VisitsModule,
    AdminModule,
    ImportsModule,
    ExportsModule
  ],
  controllers: [AppController],
  providers: [AppService]
})
export class AppModule {}
