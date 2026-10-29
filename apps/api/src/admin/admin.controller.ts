import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // USERS
  @Get('users')
  @Roles('Super Admin', 'Investigator')
  @ApiOperation({ summary: 'List personnel user records and access state' })
  getUsers() {
    return this.adminService.getUsers();
  }

  @Post('users/invite')
  @Roles('Super Admin')
  @ApiOperation({ summary: 'Invite a new user with role and department' })
  inviteUser(@Body() body: any) {
    return this.adminService.inviteUser(body);
  }

  @Post('users/:id/role')
  @Roles('Super Admin')
  @ApiOperation({ summary: 'Change user role with mandatory reason and second admin confirmation for Super Admin' })
  updateUserRole(
    @Param('id') id: string,
    @Body('role') role: 'Super Admin' | 'Investigator' | 'Reviewer' | 'Viewer',
    @Body('changeReason') changeReason: string,
    @Body('secondAdminApprovalEmail') secondAdminApprovalEmail?: string,
  ) {
    return this.adminService.updateUserRole(id, role, changeReason, secondAdminApprovalEmail);
  }

  @Post('users/:id/mfa-reset')
  @Roles('Super Admin')
  @ApiOperation({ summary: 'Reset user MFA credentials' })
  resetMfa(@Param('id') id: string, @Body('changeReason') changeReason: string) {
    return this.adminService.resetMfa(id, changeReason || 'Administrative MFA reset');
  }

  @Post('users/:id/revoke-sessions')
  @Roles('Super Admin')
  @ApiOperation({ summary: 'Revoke all active device sessions for user' })
  revokeSessions(@Param('id') id: string, @Body('changeReason') changeReason: string) {
    return this.adminService.revokeSessions(id, changeReason || 'Security logout of user devices');
  }

  // ROLES
  @Get('roles')
  @Roles('Super Admin', 'Investigator')
  @ApiOperation({ summary: 'Get RBAC permission matrix for roles' })
  getRoles() {
    return this.adminService.getRoles();
  }

  // TEAMS
  @Get('teams')
  @Roles('Super Admin', 'Investigator')
  @ApiOperation({ summary: 'List tactical investigation units' })
  getTeams() {
    return this.adminService.getTeams();
  }

  // MODELS
  @Get('models')
  @Roles('Super Admin', 'Investigator')
  @ApiOperation({ summary: 'Get AI model registry and benchmark performance metrics' })
  getModels() {
    return this.adminService.getModels();
  }

  @Post('models/:id/shadow')
  @Roles('Super Admin')
  @ApiOperation({ summary: 'Deploy model in shadow mode for side-by-side evaluation' })
  setShadowModel(@Param('id') id: string, @Body('changeReason') changeReason: string) {
    return this.adminService.setShadowModel(id, changeReason || 'Benchmarking shadow candidate model');
  }

  @Post('models/:id/promote')
  @Roles('Super Admin')
  @ApiOperation({ summary: 'Promote model to active production inference' })
  promoteModel(@Param('id') id: string, @Body('changeReason') changeReason: string) {
    return this.adminService.promoteModel(id, changeReason || 'Promoted following evaluation benchmark signoff');
  }

  // THRESHOLDS
  @Get('thresholds')
  @Roles('Super Admin', 'Investigator')
  @ApiOperation({ summary: 'Get similarity threshold profiles' })
  getThresholds() {
    return this.adminService.getThresholds();
  }

  @Post('thresholds/preview-impact')
  @Roles('Super Admin', 'Investigator')
  @ApiOperation({ summary: 'Simulate decision flips and extra review volume for threshold profile' })
  previewImpact(@Body('profileId') profileId: string) {
    return this.adminService.previewThresholdImpact(profileId);
  }

  @Post('thresholds/activate')
  @Roles('Super Admin')
  @ApiOperation({ summary: 'Activate threshold profile with second admin signoff' })
  activateThreshold(
    @Body('profileId') profileId: string,
    @Body('changeReason') changeReason: string,
    @Body('secondAdminApproval') secondAdminApproval?: string,
  ) {
    return this.adminService.activateThreshold(profileId, changeReason, secondAdminApproval);
  }

  // QUEUES
  @Get('queues')
  @Roles('Super Admin', 'Investigator')
  @ApiOperation({ summary: 'Get BullMQ queue depths and Kafka consumer lag telemetry' })
  getQueues() {
    return this.adminService.getQueues();
  }

  // INTEGRATIONS
  @Get('integrations')
  @Roles('Super Admin')
  @ApiOperation({ summary: 'Get infrastructure connection statuses and parameters' })
  getIntegrations() {
    return this.adminService.getIntegrations();
  }

  // RETENTION
  @Get('retention')
  @Roles('Super Admin', 'Investigator')
  @ApiOperation({ summary: 'Get retention policies per data classification' })
  getRetention() {
    return this.adminService.getRetention();
  }

  @Post('retention/preview-deletion')
  @Roles('Super Admin')
  @ApiOperation({ summary: 'Preview purge impact before enabling shorter retention period' })
  previewRetentionDeletion(@Body('dataClass') dataClass: string, @Body('newDays') newDays: number) {
    return this.adminService.previewRetentionDeletion(dataClass, newDays);
  }

  // AUDIT LOG
  @Get('audit')
  @Roles('Super Admin', 'Investigator')
  @ApiOperation({ summary: 'Search and inspect system-wide audit entries' })
  getAuditLog(
    @Query('actor') actor?: string,
    @Query('action') action?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.getAuditLog({ actor, action, search });
  }

  // SYSTEM HEALTH
  @Get('health')
  @ApiOperation({ summary: 'Retrieve comprehensive microservices and database health status' })
  getSystemHealth() {
    return this.adminService.getSystemHealth();
  }
}
