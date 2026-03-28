import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtUserPayload } from '../common/interfaces/jwt-user-payload.interface';
import { CreateVisitDto } from './dto/create-visit.dto';
import { VisitsService } from './visits.service';

@Controller('visits')
@UseGuards(JwtAuthGuard)
export class VisitsController {
  constructor(private readonly visitsService: VisitsService) {}

  @Get('outcomes')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin, UserRole.supervisor, UserRole.canvasser)
  listActiveOutcomes() {
    return this.visitsService.listActiveOutcomes();
  }

  @Post('log')
  logVisit(@Body() body: CreateVisitDto, @CurrentUser() user: JwtUserPayload) {
    return this.visitsService.logVisit({
      canvasserId: user.sub,
      ...body
    });
  }
}
