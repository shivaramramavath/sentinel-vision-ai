import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SearchJobsService } from './search-jobs.service';
import { TriggerSearchDto } from './dto/trigger-search.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import { AuditAction } from '../audit/decorators/audit-action.decorator';
import { AuditInterceptor } from '../audit/interceptors/audit.interceptor';

@ApiTags('Search')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UseInterceptors(AuditInterceptor)
export class SearchJobsController {
  constructor(private readonly searchJobsService: SearchJobsService) {}

  @Post(['search', 'search-jobs'])
  @RequirePermissions('searches:run')
  @UseGuards(RateLimitGuard)
  @RateLimit({ max: 10, windowMs: 60000, keyPrefix: 'search' })
  @ApiOperation({ summary: 'Initiate AI person search across surveillance cameras' })
  @AuditAction('START_SEARCH', 'SearchJob', (req, res) => res.id)
  async triggerSearch(@Body() dto: TriggerSearchDto, @Req() req: any) {
    const correlationId = req.correlationId || req.headers['x-correlation-id'] || 'none';
    return this.searchJobsService.triggerSearch(dto, correlationId);
  }

  @Get(['search/jobs', 'search-jobs'])
  @ApiOperation({ summary: 'List active and recent AI search jobs' })
  async getJobs(@Query('caseId') caseId?: string) {
    return this.searchJobsService.getActiveJobs(caseId);
  }

  @Get(['search/jobs/:id', 'search-jobs/:id'])
  @ApiOperation({ summary: 'Get status, sharding progress, and metrics of a search job' })
  async getJob(@Param('id') id: string) {
    return this.searchJobsService.getJobById(id);
  }

  @Post(['search/jobs/:id/pause', 'search-jobs/:id/pause'])
  @RequirePermissions('searches:cancel')
  @ApiOperation({ summary: 'Pause a running search job' })
  @AuditAction('PAUSE_SEARCH', 'SearchJob', (req) => req.params.id)
  async pauseJob(@Param('id') id: string) {
    return this.searchJobsService.pauseJob(id);
  }

  @Post(['search/jobs/:id/resume', 'search-jobs/:id/resume'])
  @RequirePermissions('searches:run')
  @ApiOperation({ summary: 'Resume a paused search job' })
  @AuditAction('RESUME_SEARCH', 'SearchJob', (req) => req.params.id)
  async resumeJob(@Param('id') id: string) {
    return this.searchJobsService.resumeJob(id);
  }

  @Post(['search/jobs/:id/cancel', 'search-jobs/:id/cancel'])
  @RequirePermissions('searches:cancel')
  @ApiOperation({ summary: 'Cancel an active search job' })
  @AuditAction('CANCEL_SEARCH', 'SearchJob', (req) => req.params.id)
  async cancelJob(@Param('id') id: string) {
    return this.searchJobsService.cancelJob(id);
  }
}
