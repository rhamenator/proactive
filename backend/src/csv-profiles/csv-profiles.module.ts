import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { CsvProfilesService } from './csv-profiles.service.js';

@Module({
  imports: [PrismaModule],
  providers: [CsvProfilesService],
  exports: [CsvProfilesService]
})
export class CsvProfilesModule {}
