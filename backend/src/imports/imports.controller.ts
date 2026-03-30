import { BadRequestException, Body, Controller, Get, Param, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import multer from 'multer';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtUserPayload } from '../common/interfaces/jwt-user-payload.interface';
import { resolveAccessScope } from '../common/utils/access-scope.util';
import { PoliciesService } from '../policies/policies.service';
import { ImportCsvDto } from '../turfs/dto/import-csv.dto';
import { UsersService } from '../users/users.service';
import { ListImportReviewQueueDto } from './dto/list-import-review-queue.dto';
import { ResolveImportReviewDto } from './dto/resolve-import-review.dto';
import { ImportsService } from './imports.service';

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
      duplicateStrategy: body.duplicateStrategy,
      teamId: body.teamId,
      regionCode: body.regionCode
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
