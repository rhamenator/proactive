import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CsvProfilesService } from './csv-profiles.service';

@Module({
  imports: [PrismaModule],
  providers: [CsvProfilesService],
  exports: [CsvProfilesService]
})
export class CsvProfilesModule {}
