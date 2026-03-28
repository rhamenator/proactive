import {
  Body,
  BadRequestException,
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
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtUserPayload } from '../common/interfaces/jwt-user-payload.interface';
import { AssignTurfDto } from './dto/assign-turf.dto';
import { CreateTurfDto } from './dto/create-turf.dto';
import { ImportCsvDto } from './dto/import-csv.dto';
import { TurfSessionActionDto } from './dto/turf-session-action.dto';
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
  assignTurf(
    @Param('id', ParseUUIDPipe) turfId: string,
    @Body() body: AssignTurfDto,
    @CurrentUser() user: JwtUserPayload
  ) {
    return this.turfsService.assignTurf(turfId, body.canvasserId, user.sub);
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
  @UseGuards(RolesGuard)
  @Roles(UserRole.canvasser)
  getMyTurf(@CurrentUser() user: JwtUserPayload) {
    return this.turfsService.getMyTurf(user.sub);
  }

  @Post('turf/start')
  @UseGuards(RolesGuard)
  @Roles(UserRole.canvasser)
  async startTurf(@Body() body: TurfSessionActionDto, @CurrentUser() user: JwtUserPayload) {
    return this.turfsService.startSession({
      canvasserId: user.sub,
      turfId: body.turfId,
      latitude: body.latitude,
      longitude: body.longitude
    });
  }

  @Post('turf/pause')
  @UseGuards(RolesGuard)
  @Roles(UserRole.canvasser)
  pauseTurf(@Body() body: TurfSessionActionDto, @CurrentUser() user: JwtUserPayload) {
    return this.turfsService.pauseSession({
      canvasserId: user.sub,
      turfId: body.turfId,
      latitude: body.latitude,
      longitude: body.longitude
    });
  }

  @Post('turf/resume')
  @UseGuards(RolesGuard)
  @Roles(UserRole.canvasser)
  resumeTurf(@Body() body: TurfSessionActionDto, @CurrentUser() user: JwtUserPayload) {
    return this.turfsService.resumeSession({
      canvasserId: user.sub,
      turfId: body.turfId,
      latitude: body.latitude,
      longitude: body.longitude
    });
  }

  @Post('turf/complete')
  @UseGuards(RolesGuard)
  @Roles(UserRole.canvasser)
  completeTurf(@Body() body: TurfSessionActionDto, @CurrentUser() user: JwtUserPayload) {
    return this.turfsService.completeSession({
      canvasserId: user.sub,
      turfId: body.turfId,
      latitude: body.latitude,
      longitude: body.longitude
    });
  }

  @Post('turf/end')
  @UseGuards(RolesGuard)
  @Roles(UserRole.canvasser)
  endTurf(@Body() body: TurfSessionActionDto, @CurrentUser() user: JwtUserPayload) {
    return this.turfsService.completeSession({
      canvasserId: user.sub,
      turfId: body.turfId,
      latitude: body.latitude,
      longitude: body.longitude
    });
  }
}
