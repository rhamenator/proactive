import { Module } from '@nestjs/common';
import { TurfsModule } from '../turfs/turfs.module';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';

@Module({
  imports: [TurfsModule],
  controllers: [ImportsController],
  providers: [ImportsService]
})
export class ImportsModule {}
