import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import multer from 'multer';
import { UserRole } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtUserPayload } from '../common/interfaces/jwt-user-payload.interface';
import { AssignTurfDto } from './dto/assign-turf.dto';
import { CreateTurfDto } from './dto/create-turf.dto';
import { ImportCsvDto } from './dto/import-csv.dto';
import { TurfsService } from './turfs.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class TurfsController {
  constructor(private readonly turfsService: TurfsService) {}

  @Get('turfs')
  listTurfs() {
    return this.turfsService.listTurfs();
  }

  @Post('turfs')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin)
  createTurf(@Body() body: CreateTurfDto, @CurrentUser() user: JwtUserPayload) {
    return this.turfsService.createTurf(body, user.sub);
  }

  @Post('turfs/:id/assign')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin)
  assignTurf(@Param('id', ParseUUIDPipe) turfId: string, @Body() body: AssignTurfDto) {
    return this.turfsService.assignTurf(turfId, body.canvasserId);
  }

  @Post('turfs/import-csv')
  @UseGuards(RolesGuard)
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

    return this.turfsService.importCsv({
      csv: file.buffer.toString('utf8'),
      createdById: user.sub,
      turfName: body.turfName,
      mapping
    });
  }

  @Get('turfs/:id/addresses')
  getAddresses(@Param('id', ParseUUIDPipe) turfId: string) {
    return this.turfsService.getTurfAddresses(turfId);
  }

  @Get('my-turf')
  getMyTurf(@CurrentUser() user: JwtUserPayload) {
    return this.turfsService.getMyTurf(user.sub);
  }

  @Post('turf/start')
  async startTurf(
    @Body()
    body: { turfId: string; latitude?: number; longitude?: number },
    @CurrentUser() user: JwtUserPayload
  ) {
    return this.turfsService.startSession({
      canvasserId: user.sub,
      turfId: body.turfId,
      latitude: body.latitude,
      longitude: body.longitude
    });
  }

  @Post('turf/end')
  async endTurf(
    @Body()
    body: { turfId: string; latitude?: number; longitude?: number },
    @CurrentUser() user: JwtUserPayload
  ) {
    return this.turfsService.endSession({
      canvasserId: user.sub,
      turfId: body.turfId,
      latitude: body.latitude,
      longitude: body.longitude
    });
  }
}
