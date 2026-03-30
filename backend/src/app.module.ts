import { Module } from '@nestjs/common';
import { AddressRequestsModule } from './address-requests/address-requests.module';
import { AdminModule } from './admin/admin.module';
import { AuditModule } from './audit/audit.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ExportsModule } from './exports/exports.module';
import { ImportsModule } from './imports/imports.module';
import { PoliciesModule } from './policies/policies.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReportsModule } from './reports/reports.module';
import { SecurityModule } from './security/security.module';
import { TurfsModule } from './turfs/turfs.module';
import { UsersModule } from './users/users.module';
import { VisitsModule } from './visits/visits.module';

@Module({
  imports: [
    PrismaModule,
    AddressRequestsModule,
    AuditModule,
    SecurityModule,
    UsersModule,
    AuthModule,
    PoliciesModule,
    TurfsModule,
    VisitsModule,
    AdminModule,
    ImportsModule,
    ExportsModule,
    ReportsModule
  ],
  controllers: [AppController],
  providers: [AppService]
})
export class AppModule {}
