import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { MobileJwtAuthGuard } from '../guards/mobile-jwt-auth.guard';
import { MobileDevicesService } from '../services/mobile-devices.service';
import {
  MobileAddDeviceDto,
  SessionHeartbeatDto,
} from '@sentinel/shared-types';

@ApiTags('Mobile Operator Devices & Broadcast Sessions')
@Controller('mobile')
@UseGuards(MobileJwtAuthGuard)
@ApiBearerAuth('JWT')
export class MobileDevicesController {
  private readonly logger = new Logger(MobileDevicesController.name);

  constructor(private readonly mobileDevicesService: MobileDevicesService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current mobile operator profile' })
  async getProfile(@Req() req: any) {
    return this.mobileDevicesService.getProfile(req.mobileUser.mobileUserId);
  }

  @Post('devices')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a mobile device for camera streaming' })
  async addDevice(@Req() req: any, @Body() dto: MobileAddDeviceDto) {
    return this.mobileDevicesService.addDevice(req.mobileUser.mobileUserId, dto);
  }

  @Get('devices')
  @ApiOperation({ summary: 'List registered devices for the current mobile operator' })
  async listDevices(@Req() req: any) {
    return this.mobileDevicesService.listDevices(req.mobileUser.mobileUserId);
  }

  @Patch('devices/:id')
  @ApiOperation({ summary: 'Update device configuration' })
  async updateDevice(@Req() req: any, @Param('id') id: string, @Body() dto: any) {
    return this.mobileDevicesService.updateDevice(req.mobileUser.mobileUserId, id, dto);
  }

  @Delete('devices/:id')
  @ApiOperation({ summary: 'Revoke and delete a mobile device' })
  async deleteDevice(@Req() req: any, @Param('id') id: string) {
    return this.mobileDevicesService.deleteDevice(req.mobileUser.mobileUserId, id);
  }

  @Post('devices/:id/sessions')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Initialize WebRTC WHIP streaming broadcast session' })
  async startSession(
    @Req() req: any,
    @Param('id') deviceId: string,
    @Body('deviceKey') deviceKey?: string,
  ) {
    return this.mobileDevicesService.startSession(
      req.mobileUser.mobileUserId,
      deviceId,
      deviceKey,
    );
  }

  @Post('sessions/:id/token-refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh WHIP publish JWT token at 60% TTL' })
  async refreshToken(@Req() req: any, @Param('id') sessionId: string) {
    return this.mobileDevicesService.refreshToken(sessionId, req.mobileUser.mobileUserId);
  }

  @Post('sessions/:id/heartbeat')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stream telemetry heartbeat with battery and optional GPS' })
  async heartbeat(
    @Req() req: any,
    @Param('id') sessionId: string,
    @Body() dto: SessionHeartbeatDto,
  ) {
    return this.mobileDevicesService.heartbeat(sessionId, req.mobileUser.mobileUserId, dto);
  }

  @Post('sessions/:id/stop')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stop live camera broadcast session' })
  async stopSession(@Req() req: any, @Param('id') sessionId: string) {
    return this.mobileDevicesService.stopSession(sessionId, req.mobileUser.mobileUserId);
  }

  @Get('time')
  @ApiOperation({ summary: 'Server time for clock offset estimation' })
  async getServerTime() {
    return { serverTimeMs: Date.now() };
  }
}
