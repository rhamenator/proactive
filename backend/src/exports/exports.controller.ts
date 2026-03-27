import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { UserRole } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ExportsService } from './exports.service';

@Controller('exports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.admin)
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  @Get('van-results')
  async vanResultsCsv(
    @Query('turfId') turfId?: string,
    @Query('markExported') markExported?: string,
    @Res() response?: Response
  ) {
    const result = await this.exportsService.vanResultsCsv({
      turfId,
      markExported: markExported === 'true'
    });

    if (!response) {
      return result;
    }

    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', 'attachment; filename="van-results.csv"');
    return response.send(result.csv);
  }
}
