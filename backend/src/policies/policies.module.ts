import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PoliciesService } from './policies.service.js';

@Module({
  imports: [PrismaModule],
  providers: [PoliciesService],
  exports: [PoliciesService]
})
export class PoliciesModule {}
