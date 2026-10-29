import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { MobileAdminService } from '../services/mobile-admin.service';
import { AdminCreateInviteDto } from '@sentinel/shared-types';

@ApiTags('Admin Mobile Operators & Fleet Management')
@Controller('admin/mobile')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT')
export class MobileAdminController {
  private readonly logger = new Logger(MobileAdminController.name);

  constructor(private readonly mobileAdminService: MobileAdminService) {}

  @Get('users')
  @ApiOperation({ summary: 'List mobile operators with optional status filter' })
  async listUsers(@Query('status') status?: string) {
    return this.mobileAdminService.listUsers(status);
  }

  @Post('users/:id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve pending mobile operator registration' })
  async approveUser(@Param('id') id: string, @Req() req: any) {
    return this.mobileAdminService.updateUserStatus(id, 'approve', req.user?.id);
  }

  @Post('users/:id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject pending mobile operator registration' })
  async rejectUser(@Param('id') id: string, @Req() req: any) {
    return this.mobileAdminService.updateUserStatus(id, 'reject', req.user?.id);
  }

  @Post('users/:id/suspend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Suspend active mobile operator' })
  async suspendUser(@Param('id') id: string, @Req() req: any) {
    return this.mobileAdminService.updateUserStatus(id, 'suspend', req.user?.id);
  }

  @Post('users/:id/reactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reactivate suspended mobile operator' })
  async reactivateUser(@Param('id') id: string, @Req() req: any) {
    return this.mobileAdminService.updateUserStatus(id, 'reactivate', req.user?.id);
  }

  @Get('devices')
  @ApiOperation({ summary: 'List mobile streaming devices' })
  async listDevices(@Query('status') status?: string) {
    return this.mobileAdminService.listDevices(status);
  }

  @Post('devices/:id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve mobile streaming device' })
  async approveDevice(@Param('id') id: string, @Req() req: any) {
    return this.mobileAdminService.updateDeviceStatus(id, 'approve', req.user?.id);
  }

  @Post('devices/:id/revoke')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke mobile streaming device and disconnect stream' })
  async revokeDevice(@Param('id') id: string, @Req() req: any) {
    return this.mobileAdminService.updateDeviceStatus(id, 'revoke', req.user?.id);
  }

  @Post('invites')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create shareable invite code with site mapping' })
  async createInvite(@Body() dto: AdminCreateInviteDto, @Req() req: any) {
    return this.mobileAdminService.createInvite(dto, req.user?.id);
  }

  @Get('invites')
  @ApiOperation({ summary: 'List all mobile registration invites' })
  async listInvites() {
    return this.mobileAdminService.listInvites();
  }

  @Post('invites/:id/revoke')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke an invite code' })
  async revokeInvite(@Param('id') id: string, @Req() req: any) {
    return this.mobileAdminService.revokeInvite(id, req.user?.id);
  }

  @Get('sessions/active')
  @ApiOperation({ summary: 'List currently active mobile streaming sessions' })
  async getActiveSessions() {
    return this.mobileAdminService.getActiveSessions();
  }
}
