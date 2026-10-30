import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Headers,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiHeader, ApiQuery } from '@nestjs/swagger';
import { MissingPersonsService } from './missing-persons.service';
import {
  CreateMissingPersonDto,
  UpdateMissingPersonDto,
  NewLastSeenDto,
  UpdateStatusDto,
} from './dto/missing-person.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { RbacDataShapingInterceptor } from '../rbac/interceptors/rbac-data-shaping.interceptor';
import { AuditAction } from '../audit/decorators/audit-action.decorator';
import { AuditInterceptor } from '../audit/interceptors/audit.interceptor';

@ApiTags('Missing Persons')
@ApiBearerAuth()
@Controller('missing-persons')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UseInterceptors(RbacDataShapingInterceptor)
@UseInterceptors(AuditInterceptor)
export class MissingPersonsController {
  constructor(private readonly missingPersonsService: MissingPersonsService) {}

  @Post()
  @RequirePermissions('cases:update')
  @ApiOperation({ summary: 'Create missing person dossier (draft saves allowed)' })
  @AuditAction('CREATE_MISSING_PERSON', 'MissingPerson', (req, res) => res.personId)
  async create(@Body() dto: CreateMissingPersonDto, @Req() req: any) {
    const actor = req?.user?.email || 'Investigator';
    return this.missingPersonsService.create(dto, actor);
  }

  @Get()
  @ApiOperation({ summary: 'List missing persons dossiers' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'priority', required: false })
  @ApiQuery({ name: 'search', required: false })
  async findAll(
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('search') search?: string,
  ) {
    return this.missingPersonsService.findAll({ status, priority, search });
  }

  @Get('duplicates')
  @ApiOperation({ summary: 'Detect potential duplicate cases for human review using perceptual face hash similarity' })
  @ApiQuery({ name: 'faceRefId', required: false })
  async getDuplicates(@Query('faceRefId') faceRefId?: string) {
    return this.missingPersonsService.getDuplicates(faceRefId);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search missing persons with text match across names, aliases, and cases' })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'priority', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async search(
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('limit') limit?: string,
  ) {
    return this.missingPersonsService.searchDossiers({
      q,
      status,
      priority,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Post('search-by-photo')
  @ApiOperation({ summary: 'Search existing cases ranked by photo face/body similarity for human decision' })
  async searchByPhoto(@Body() dto: { photoUrl?: string; imageBase64?: string }) {
    return this.missingPersonsService.searchByPhoto(dto);
  }

  @Get(':id/readiness')
  @ApiOperation({ summary: 'Calculate search readiness score (0-100), breakdown, and recommendations' })
  async getReadiness(@Param('id') id: string) {
    return this.missingPersonsService.getReadiness(id);
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'Get field-level before/after diff audit history for dossier' })
  async getHistory(@Param('id') id: string) {
    return this.missingPersonsService.getHistory(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get missing person dossier by ID or personId' })
  async findById(@Param('id') id: string) {
    return this.missingPersonsService.findById(id);
  }

  @Patch(':id')
  @RequirePermissions('cases:update')
  @ApiOperation({ summary: 'Partial update with optimistic concurrency control (If-Match header, 409 on conflict)' })
  @ApiHeader({ name: 'if-match', required: false, description: 'Expected document version integer' })
  @AuditAction('UPDATE_MISSING_PERSON', 'MissingPerson', (req) => req.params.id)
  async patch(
    @Param('id') id: string,
    @Body() dto: UpdateMissingPersonDto,
    @Headers('if-match') ifMatch: string,
    @Req() req: any,
  ) {
    const actor = req?.user?.email || 'Investigator';
    return this.missingPersonsService.patch(id, dto, ifMatch, actor);
  }

  @Post(':id/submit')
  @RequirePermissions('cases:update')
  @ApiOperation({ summary: 'Submit dossier: validates mandatory fields + statutory authority + minimum references -> status=active' })
  @AuditAction('SUBMIT_MISSING_PERSON', 'MissingPerson', (req) => req.params.id)
  async submit(@Param('id') id: string, @Req() req: any) {
    const actor = req?.user?.email || 'Investigator';
    return this.missingPersonsService.submit(id, actor);
  }

  @Post(':id/last-seen')
  @RequirePermissions('cases:update')
  @ApiOperation({ summary: 'Submit new last-seen information: appends history, recomputes reachable area, triggers auto-search' })
  @AuditAction('UPDATE_LAST_SEEN', 'MissingPerson', (req) => req.params.id)
  async addLastSeen(
    @Param('id') id: string,
    @Body() dto: NewLastSeenDto,
    @Req() req: any,
  ) {
    const actor = req?.user?.email || 'Investigator';
    return this.missingPersonsService.addLastSeen(id, dto, actor);
  }

  @Post(':id/status')
  @RequirePermissions('cases:update')
  @ApiOperation({ summary: 'Transition dossier lifecycle status (found/closed stops running jobs and schedules retention)' })
  @AuditAction('UPDATE_STATUS', 'MissingPerson', (req) => req.params.id)
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
    @Req() req: any,
  ) {
    const actor = req?.user?.email || 'Investigator';
    return this.missingPersonsService.updateStatus(id, dto, actor);
  }
}
