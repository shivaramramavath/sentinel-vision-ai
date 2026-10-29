import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JourneysService } from './journeys.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

@ApiTags('Journeys')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class JourneysController {
  constructor(private readonly journeysService: JourneysService) {}

  @Get('journeys')
  @ApiOperation({ summary: 'Get tracking journeys by caseId query' })
  async getJourneysByQuery(@Query('caseId') caseId: string) {
    if (!caseId) return [];
    const journey = await this.journeysService.getJourneyForCase(caseId);
    return [journey];
  }

  @Get('cases/:caseId/journey')
  @ApiOperation({ summary: 'Reconstruct cross-camera tracking trajectory for a case' })
  async getJourney(@Param('caseId') caseId: string) {
    return this.journeysService.getJourneyForCase(caseId);
  }
}
