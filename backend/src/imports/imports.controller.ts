import { BadRequestException, Body, Controller, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import multer from 'multer';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtUserPayload } from '../common/interfaces/jwt-user-payload.interface';
import { ImportCsvDto } from '../turfs/dto/import-csv.dto';
import { ImportsService } from './imports.service';

@Controller('imports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Post('csv')
  @Roles(UserRole.admin)
  @UseInterceptors(FileInterceptor('file', { storage: multer.memoryStorage() }))
  async importCsv(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: ImportCsvDto,
    @CurrentUser() user: JwtUserPayload
  ) {
    if (!file) {
      throw new BadRequestException('CSV file is required');
    }

    let mapping: Record<string, string> | undefined;
    if (body.mapping) {
      try {
        mapping = JSON.parse(body.mapping) as Record<string, string>;
      } catch {
        throw new BadRequestException('mapping must be valid JSON');
      }
    }

    return this.importsService.importCsv({
      csv: file.buffer.toString('utf8'),
      createdById: user.sub,
      turfName: body.turfName,
      mapping,
      mode: body.mode,
      duplicateStrategy: body.duplicateStrategy
    });
  }
}
