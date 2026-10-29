import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CasesService } from './cases.service';
import { CreateCaseDto, UpdateCaseStatusDto } from './dto/create-case.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CaseAccessGuard } from '../auth/guards/case-access.guard';
import { AuditAction } from '../audit/decorators/audit-action.decorator';
import { AuditInterceptor } from '../audit/interceptors/audit.interceptor';

@ApiTags('Cases')
@ApiBearerAuth()
@Controller('cases')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(AuditInterceptor)
export class CasesController {
  constructor(private readonly casesService: CasesService) {}

  @Get()
  @ApiOperation({ summary: 'List all missing person cases' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'priority', required: false })
  async getCases(
    @Query('status') status?: string,
    @Query('priority') priority?: string,
  ) {
    return this.casesService.findAll(status, priority);
  }

  @Get(':id/journey/geojson')
  @UseGuards(CaseAccessGuard)
  @ApiOperation({ summary: 'Get case journey as GeoJSON FeatureCollection (ordered Points + LineString)' })
  async getJourneyGeoJson(@Param('id') id: string) {
    return this.casesService.getJourneyGeoJson(id);
  }

  @Get(':id/possible-area')
  @UseGuards(CaseAccessGuard)
  @ApiOperation({ summary: 'Get case estimated reachable area circle polygon (1.4 m/s walking speed)' })
  @ApiQuery({ name: 'at', required: false, description: 'Evaluation ISO timestamp (default now)' })
  async getPossibleArea(
    @Param('id') id: string,
    @Query('at') at?: string,
  ) {
    return this.casesService.getPossibleArea(id, at);
  }

  @Get(':id/references/history')
  @UseGuards(CaseAccessGuard)
  @ApiOperation({ summary: 'Get case reference set version audit history' })
  async getReferenceHistory(@Param('id') id: string) {
    return this.casesService.getReferenceVersionHistory(id);
  }

  @Get(':id/journeys')
  @UseGuards(CaseAccessGuard)
  @ApiOperation({ summary: 'Get top-3 alternative cross-camera tracking journeys' })
  async getJourneys(@Param('id') id: string) {
    return this.casesService.getAlternativeJourneys(id);
  }

  @Get(':id/journeys/:journeyId')
  @UseGuards(CaseAccessGuard)
  @ApiOperation({ summary: 'Get specific cross-camera tracking journey variant' })
  async getJourneyById(
    @Param('id') id: string,
    @Param('journeyId') journeyId: string,
  ) {
    return this.casesService.getJourneyById(id, journeyId);
  }

  @Get(':id/overview')
  @ApiOperation({ summary: 'Get case overview including readiness score and review counts' })
  async getOverview(@Param('id') id: string, @Req() req: any) {
    return this.casesService.getOverview(id, req.user);
  }

  @Get(':id')
  @UseGuards(CaseAccessGuard)
  @ApiOperation({ summary: 'Get case by ID with access-controlled PII' })
  async getCase(@Param('id') id: string, @Req() req: any) {
    return this.casesService.findById(id, req.user);
  }

  @Post()
  @Roles('Super Admin', 'Investigator')
  @ApiOperation({ summary: 'Create new missing person case' })
  @AuditAction('CREATE_CASE', 'Case', (req, res) => res.id)
  async createCase(@Body() dto: CreateCaseDto) {
    return this.casesService.create(dto);
  }

  @Patch(':id/status')
  @Roles('Super Admin', 'Investigator')
  @UseGuards(CaseAccessGuard)
  @ApiOperation({ summary: 'Update case status' })
  @AuditAction('UPDATE_CASE_STATUS', 'Case', (req) => req.params.id)
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateCaseStatusDto,
  ) {
    return this.casesService.updateStatus(id, dto.status);
  }

  @Post(':id/close')
  @Roles('Super Admin', 'Investigator')
  @UseGuards(CaseAccessGuard)
  @ApiOperation({ summary: 'Execute case-closure workflow, lock evidence, and log final archival audit' })
  @AuditAction('CLOSE_CASE', 'Case', (req) => req.params.id)
  async closeCase(
    @Param('id') id: string,
    @Body('closureNotes') closureNotes: string,
    @Req() req: any,
  ) {
    const actor = req.user?.email || 'investigator@sentinel.local';
    return this.casesService.closeCase(id, closureNotes || 'Case closed by investigator', actor);
  }
}
