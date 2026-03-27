import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { JwtUserPayload } from '../common/interfaces/jwt-user-payload.interface';
import { CreateVisitDto } from './dto/create-visit.dto';
import { VisitsService } from './visits.service';

@Controller('visits')
@UseGuards(JwtAuthGuard)
export class VisitsController {
  constructor(private readonly visitsService: VisitsService) {}

  @Post('log')
  logVisit(@Body() body: CreateVisitDto, @CurrentUser() user: JwtUserPayload) {
    return this.visitsService.logVisit({
      canvasserId: user.sub,
      ...body
    });
  }
}
