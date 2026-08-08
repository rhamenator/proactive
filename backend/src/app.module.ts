import { Module } from '@nestjs/common';
import { AddressRequestsModule } from './address-requests/address-requests.module.js';
import { AdminModule } from './admin/admin.module.js';
import { AuditModule } from './audit/audit.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { ExportsModule } from './exports/exports.module.js';
import { GeographiesModule } from './geographies/geographies.module.js';
import { ImportsModule } from './imports/imports.module.js';
import { PoliciesModule } from './policies/policies.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { RetentionModule } from './retention/retention.module.js';
import { SecurityModule } from './security/security.module.js';
import { SystemSettingsModule } from './system-settings/system-settings.module.js';
import { TurfsModule } from './turfs/turfs.module.js';
import { UsersModule } from './users/users.module.js';
import { VisitsModule } from './visits/visits.module.js';

@Module({
  imports: [
    PrismaModule,
    AddressRequestsModule,
    AuditModule,
    SecurityModule,
    SystemSettingsModule,
    UsersModule,
    AuthModule,
    PoliciesModule,
    RetentionModule,
    TurfsModule,
    VisitsModule,
    AdminModule,
    ImportsModule,
    ExportsModule,
    GeographiesModule,
    ReportsModule
  ],
  controllers: [AppController],
  providers: [AppService]
})
export class AppModule {}
