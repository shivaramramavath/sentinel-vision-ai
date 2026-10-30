import {
  Controller,
  Get,
  Put,
  Body,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('counts')
  @ApiOperation({ summary: 'Get global or case-specific counts and badge metrics' })
  async getCounts(@Query('scope') scope?: string) {
    return this.dashboardService.getCounts(scope || 'global');
  }

  @Get('dashboard/summary')
  @ApiOperation({ summary: 'Get unified KPI strip summary metrics' })
  async getSummary(
    @Query('site') site?: string,
    @Query('range') range?: string,
  ) {
    return this.dashboardService.getSummary(site, range);
  }

  @Get('dashboard/priority-cases')
  @ApiOperation({ summary: 'Get top ranked priority cases with server-side priority score and map payload' })
  async getPriorityCases(@Query('limit') limit?: number) {
    return this.dashboardService.getPriorityCases(limit ? Number(limit) : 5);
  }

  @Get('dashboard/action-queue')
  @ApiOperation({ summary: 'Get actionable items requiring human intervention' })
  async getActionQueue(
    @Query('filter') filter?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.dashboardService.getActionQueue(filter);
  }

  @Get('dashboard/suggestions')
  @ApiOperation({ summary: 'Get active rule-based suggestions and coverage gaps' })
  async getSuggestions() {
    return this.dashboardService.getSuggestions();
  }

  @Get('dashboard/activity')
  @ApiOperation({ summary: 'Get recent multi-case event activity feed' })
  async getActivity(
    @Query('scope') scope?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.dashboardService.getActivity(scope);
  }

  @Get('dashboard/trends')
  @ApiOperation({ summary: 'Get performance and calibration trend data' })
  async getTrends(
    @Query('metric') metric?: string,
    @Query('range') range?: string,
  ) {
    return this.dashboardService.getTrends();
  }

  @Get('dashboard/team')
  @RequirePermissions('dashboard:read')
  @ApiOperation({ summary: 'Get team workload distribution and active on-call status (supervisor only)' })
  async getTeamWorkload() {
    return this.dashboardService.getTeamWorkload();
  }

  @Get('dashboard/since')
  @ApiOperation({ summary: 'Get since-you-left change digest' })
  async getSinceDigest(@Query('ts') ts?: string) {
    return this.dashboardService.getSinceDigest(ts);
  }

  @Get('users/me/dashboard-layout')
  @ApiOperation({ summary: 'Get customizable dashboard layout configuration' })
  async getDashboardLayout(@Request() req: any) {
    const userId = req.user?.id || 'usr_001';
    return this.dashboardService.getLayout(userId);
  }

  @Put('users/me/dashboard-layout')
  @ApiOperation({ summary: 'Update customizable dashboard layout configuration' })
  async updateDashboardLayout(@Request() req: any, @Body() layout: any) {
    const userId = req.user?.id || 'usr_001';
    return this.dashboardService.saveLayout(userId, layout);
  }
}
