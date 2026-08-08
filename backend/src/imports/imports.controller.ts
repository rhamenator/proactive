import { BadRequestException, Body, Controller, Get, Param, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import multer from 'multer';
import { UserRole } from '../../generated/prisma/client.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import type { JwtUserPayload } from '../common/interfaces/jwt-user-payload.interface.js';
import { resolveAccessScope } from '../common/utils/access-scope.util.js';
import { decodeCsvBuffer } from '../common/utils/csv.util.js';
import { PoliciesService } from '../policies/policies.service.js';
import { ImportCsvDto } from '../turfs/dto/import-csv.dto.js';
import { UsersService } from '../users/users.service.js';
import { ListImportReviewQueueDto } from './dto/list-import-review-queue.dto.js';
import { ResolveImportReviewDto } from './dto/resolve-import-review.dto.js';
import { ImportsService } from './imports.service.js';

const MAX_CSV_UPLOAD_BYTES = 50 * 1024 * 1024; // 50MB

@Controller('imports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ImportsController {
  constructor(
    private readonly importsService: ImportsService,
    private readonly usersService: UsersService,
    private readonly policiesService: PoliciesService
  ) {}

  @Get('history')
  @Roles(UserRole.admin)
  async importHistory(@CurrentUser() user: JwtUserPayload) {
    return this.importsService.importHistory(await resolveAccessScope(user, this.usersService, this.policiesService));
  }

  @Get('review-queue')
  @Roles(UserRole.admin)
  async importReviewQueue(
    @CurrentUser() user: JwtUserPayload,
    @Query() query: ListImportReviewQueueDto
  ) {
    return this.importsService.importReviewQueue({
      scope: await resolveAccessScope(user, this.usersService, this.policiesService),
      take: query.take
    });
  }

  @Get('history/:id/download')
  @Roles(UserRole.admin)
  async downloadImportBatch(
    @Param('id') batchId: string,
    @CurrentUser() user: JwtUserPayload,
    @Res() response: Response
  ) {
    const result = await this.importsService.downloadImportBatch(
      batchId,
      await resolveAccessScope(user, this.usersService, this.policiesService)
    );
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    return response.send(result.csv);
  }

  @Post('preview')
  @Roles(UserRole.admin)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multer.memoryStorage(),
      limits: { fileSize: MAX_CSV_UPLOAD_BYTES }
    })
  )
  async previewCsv(
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

    return this.importsService.previewCsv({
      csv: decodeCsvBuffer(file.buffer),
      createdById: user.sub,
      turfName: body.turfName,
      mapping,
      profileCode: body.profileCode,
      mode: body.mode,
      duplicateStrategy: body.duplicateStrategy,
      teamId: body.teamId,
      regionCode: body.regionCode,
      geographyExternalId: body.geographyExternalId
    });
  }

  @Post('csv')
  @Roles(UserRole.admin)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multer.memoryStorage(),
      limits: { fileSize: MAX_CSV_UPLOAD_BYTES }
    })
  )
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
      csv: decodeCsvBuffer(file.buffer),
      createdById: user.sub,
      turfName: body.turfName,
      mapping,
      profileCode: body.profileCode,
      mode: body.mode,
      duplicateStrategy: body.duplicateStrategy,
      teamId: body.teamId,
      regionCode: body.regionCode,
      geographyExternalId: body.geographyExternalId
    });
  }

  @Post('review-queue/:id/resolve')
  @Roles(UserRole.admin)
  async resolveImportReview(
    @Param('id') id: string,
    @Body() body: ResolveImportReviewDto,
    @CurrentUser() user: JwtUserPayload
  ) {
    return this.importsService.resolveImportReview({
      rowId: id,
      scope: await resolveAccessScope(user, this.usersService, this.policiesService),
      actorUserId: user.sub,
      action: body.action,
      reason: body.reason
    });
  }
}
