import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AlertsService } from './alerts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';

@ApiTags('Alerts')
@ApiBearerAuth()
@Controller('alerts')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get aggregated unread & critical alert counts for bells and badges' })
  async getSummary() {
    return this.alertsService.getSummary();
  }

  @Get()
  @ApiOperation({ summary: 'List alerts with multi-parameter filtering and deduplication' })
  async getAlerts(
    @Query('status') status?: string,
    @Query('severity') severity?: string,
    @Query('type') type?: string,
    @Query('caseId') caseId?: string,
    @Query('search') search?: string,
  ) {
    return this.alertsService.findAll({ status, severity, type, caseId, search });
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark alert notification as read' })
  async markRead(@Param('id') id: string) {
    return this.alertsService.markAsRead(id);
  }

  @Post(':id/ack')
  @ApiOperation({ summary: 'Acknowledge alert notification' })
  async acknowledge(@Param('id') id: string, @Request() req: any) {
    const actor = req.user?.email || 'operator@sentinel.gov';
    return this.alertsService.acknowledge(id, actor);
  }

  @Post(':id/assign')
  @ApiOperation({ summary: 'Assign alert to an investigator or team member' })
  async assign(
    @Param('id') id: string,
    @Body('assigneeId') assigneeId: string,
    @Body('assigneeName') assigneeName: string,
  ) {
    return this.alertsService.assign(id, assigneeId, assigneeName);
  }

  @Post(':id/snooze')
  @ApiOperation({ summary: 'Snooze alert notification for duration in minutes' })
  async snooze(@Param('id') id: string, @Body('durationMinutes') durationMinutes?: number) {
    return this.alertsService.snooze(id, durationMinutes || 60);
  }

  @Post(':id/resolve')
  @ApiOperation({ summary: 'Resolve alert notification with audit note' })
  async resolve(
    @Param('id') id: string,
    @Body('note') note: string,
    @Request() req: any,
  ) {
    const actor = req.user?.email || 'operator@sentinel.gov';
    return this.alertsService.resolve(id, note || 'Resolved by operator', actor);
  }

  @Post(':id/escalate')
  @ApiOperation({ summary: 'Manually escalate alert to shift supervisor' })
  async escalate(@Param('id') id: string) {
    return this.alertsService.escalate(id);
  }

  @Post('bulk-action')
  @ApiOperation({ summary: 'Execute bulk acknowledge, snooze or resolve across multiple alerts' })
  async bulkAction(
    @Body('action') action: 'ack' | 'resolve' | 'snooze',
    @Body('alertIds') alertIds: string[],
  ) {
    return this.alertsService.bulkAction(action, alertIds);
  }

  @Get('rules')
  @ApiOperation({ summary: 'List configured alert trigger rules' })
  getRules() {
    return this.alertsService.getRules();
  }

  @Post('rules')
  @RequirePermissions('alerts:act')
  @ApiOperation({ summary: 'Create a new alert trigger rule' })
  createRule(@Body() body: any, @Request() req: any) {
    const owner = req.user?.email || 'supervisor@sentinel.gov';
    return this.alertsService.createRule(body, owner);
  }

  @Post('rules/:id/test')
  @ApiOperation({ summary: 'Simulate rule against last 24h data' })
  testRule(@Param('id') id: string) {
    return this.alertsService.testRule(id);
  }

  @Get('channels')
  @ApiOperation({ summary: 'List notification dispatch channels' })
  getChannels() {
    return this.alertsService.getChannels();
  }

  @Post('channels')
  @RequirePermissions('alerts:manage_rules')
  @ApiOperation({ summary: 'Register a new notification dispatch channel' })
  createChannel(@Body() body: any) {
    return this.alertsService.createChannel(body);
  }

  @Post('channels/:id/test')
  @ApiOperation({ summary: 'Send test payload to channel' })
  testChannel(@Param('id') id: string) {
    return this.alertsService.testChannel(id);
  }

  @Get('oncall')
  @ApiOperation({ summary: 'Get current tactical on-call rotation schedule' })
  getOnCall() {
    return this.alertsService.getOnCall();
  }

  @Post('oncall/override')
  @RequirePermissions('alerts:act')
  @ApiOperation({ summary: 'Override active shift commander' })
  overrideOnCall(@Body('officerId') officerId: string) {
    return this.alertsService.overrideOnCall(officerId);
  }
}
