import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PoliciesService } from './policies.service';

@Module({
  imports: [PrismaModule],
  providers: [PoliciesService],
  exports: [PoliciesService]
})
export class PoliciesModule {}
