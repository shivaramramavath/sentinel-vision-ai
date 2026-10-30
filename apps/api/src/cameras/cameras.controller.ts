import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { CamerasService } from './cameras.service';
import { CameraStatus } from './schemas/camera.schema';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CreateCameraDto } from './dto/create-camera.dto';
import { UpdateCameraDto } from './dto/update-camera.dto';
import { TestConnectionDto } from './dto/test-connection.dto';
import {
  MobileTelemetryDto,
  ClockSyncRequestDto,
} from './dto/camera-telemetry.dto';
import { BulkImportDto } from './dto/bulk-import.dto';
import { BandwidthEstimateDto } from './dto/bandwidth-budget.dto';
import {
  CreateVideoSegmentDto,
  ExportClipDto,
  CreateEventClipDto,
} from './dto/video-segment.dto';
import { PlaybackStreamingService } from './services/playback-streaming.service';
import { StorageLifecycleService } from './services/storage-lifecycle.service';
import { Response } from 'express';
import { Res } from '@nestjs/common';

@ApiTags('Surveillance Cameras & Edge Feeds')
@Controller('cameras')
export class CamerasController {
  constructor(
    private readonly camerasService: CamerasService,
    private readonly playbackService: PlaybackStreamingService,
    private readonly storageLifecycleService: StorageLifecycleService,
  ) {}

  // ─── Connection Probe (ffprobe) ──────────────────────────────────
  @Post('test-connection')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cameras:manage')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Test RTSP/IP camera connection via ffprobe (timeout 8s)',
    description:
      'Probes video stream codec, resolution, fps, bitrate and validates compatibility before camera onboarding',
  })
  async testConnection(@Body() dto: TestConnectionDto) {
    return this.camerasService.testConnection(dto);
  }

  // ─── Camera Registration ─────────────────────────────────────────
  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cameras:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register a new camera (CCTV, Mobile, USB, File)' })
  async createCamera(@Body() dto: CreateCameraDto, @Req() req: any) {
    const userEmail = req.user?.email || 'admin@sentinel.gov';
    return this.camerasService.create(dto, userEmail);
  }

  @Get()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cameras:read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List surveillance cameras with optional status and zone filters' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'location', required: false })
  async listCameras(
    @Query('status') status?: CameraStatus,
    @Query('location') location?: string,
  ) {
    return this.camerasService.findAll(status, location);
  }

  @Get('geojson')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cameras:read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retrieve camera locations as GeoJSON FeatureCollection (Redis cached)' })
  async getGeoJson(
    @Query('siteId') siteId?: string,
    @Query('status') status?: CameraStatus,
  ) {
    return this.camerasService.getGeoJson(siteId, status);
  }

  @Get('nearby')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cameras:read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Discover cameras within radius via Redis GEO / $geoNear' })
  async getNearby(
    @Query('lat') lat: number,
    @Query('lng') lng: number,
    @Query('radiusM', new ParseIntPipe({ optional: true })) radiusM = 500,
  ): Promise<any[]> {
    return this.camerasService.getNearby(Number(lat), Number(lng), radiusM);
  }

  @Get('next-search')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('searches:run')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Rank candidate CCTV cameras to search next based on reachability & heading' })
  async getNextCamerasToSearch(
    @Query('fromCameraId') fromCameraId: string,
    @Query('atTime') atTime?: string,
    @Query('maxRadiusMeters', new ParseIntPipe({ optional: true })) maxRadiusMeters = 3000,
  ) {
    return this.camerasService.rankNextCameras(fromCameraId, atTime, maxRadiusMeters);
  }

  @Get('topology')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cameras:read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Fetch camera network transit topology' })
  async getTopology() {
    return this.camerasService.getTopology();
  }

  @Put('topology/:from/:to')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('topology:edit')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Configure or calibrate transit edge between two cameras' })
  async updateTopology(
    @Param('from') from: string,
    @Param('to') to: string,
    @Body() dto: any,
  ) {
    return this.camerasService.updateTopology(from, to, dto);
  }

  @Patch('topology/transitions/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('topology:edit')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update specific topology transition edge' })
  async patchTransition(@Param('id') id: string, @Body() dto: any) {
    return this.camerasService.patchTransition(id, dto);
  }


  // ─── ONVIF Discovery ─────────────────────────────────────────────
  @Post('discover/onvif')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cameras:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Probe site subnet for ONVIF NVTs via WS-Discovery' })
  async discoverOnvif(@Query('subnet') subnet?: string) {
    return this.camerasService.discoverOnvif(subnet);
  }

  // ─── Bulk CSV Import ─────────────────────────────────────────────
  @Post('bulk-import')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cameras:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bulk import cameras via CSV text with dry-run verification' })
  async bulkImport(@Body() dto: BulkImportDto, @Req() req: any) {
    const userEmail = req.user?.email || 'admin@sentinel.gov';
    return this.camerasService.bulkImport(dto, userEmail);
  }

  // ─── Bandwidth Budget & Multi-Node Capacity ───────────────────────
  @Get('bandwidth/report')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('admin:system')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get multi-node bandwidth ingestion report and storage forecast' })
  async getBandwidthReport() {
    return this.camerasService.getBandwidthReport();
  }

  @Post('bandwidth/estimate')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cameras:manage')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Estimate bandwidth budget and storage from camera count, bitrate, and recording mode' })
  async estimateBandwidth(@Body() dto: BandwidthEstimateDto) {
    return this.camerasService.estimateBandwidthBudget(dto);
  }

  // ─── Single Camera Operations ────────────────────────────────────
  @Get(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cameras:read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get camera details by ID' })
  async getCamera(@Param('id') id: string) {
    return this.camerasService.findById(id);
  }

  @Get(':id/gaps')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cameras:read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get gap-aware recording disruption records for camera' })
  async getCameraGaps(@Param('id') id: string) {
    return this.camerasService.getRecordingGaps(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cameras:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update camera metadata, policies, location, or stream configuration' })
  async updateCamera(
    @Param('id') id: string,
    @Body() dto: UpdateCameraDto,
  ) {
    return this.camerasService.update(id, dto);
  }

  @Post(':id/enable')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cameras:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Enable camera and re-add stream path to MediaMTX' })
  async enableCamera(@Param('id') id: string) {
    return this.camerasService.enable(id);
  }

  @Post(':id/disable')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cameras:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disable camera and tear down MediaMTX path' })
  async disableCamera(@Param('id') id: string) {
    return this.camerasService.disable(id);
  }

  @Post(':id/mobile-telemetry')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Periodic GPS and device status updates from paired mobile camera PWA' })
  async updateMobileTelemetry(
    @Param('id') id: string,
    @Body() dto: MobileTelemetryDto,
  ) {
    return this.camerasService.updateMobileTelemetry(id, dto);
  }

  @Post(':id/clock-sync')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'NTP-style round-trip clock sync for accurate cross-camera temporal alignment' })
  async syncClock(
    @Param('id') id: string,
    @Body() dto: ClockSyncRequestDto,
  ) {
    return this.camerasService.syncClock(id, dto);
  }

  @Get(':id/sampler-metrics')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cameras:read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get live frame sampler diagnostics (fps in/out, dropped frames, motion skipped %, latency)' })
  async getSamplerMetrics(@Param('id') id: string) {
    return this.camerasService.getSamplerMetrics(id);
  }

  @Post(':id/sample-fps')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cameras:manage')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Dynamically configure adaptive sampling rate (e.g. 2-8 FPS) via Redis control key' })
  async setSampleFps(
    @Param('id') id: string,
    @Body('sampleFps') sampleFps: number,
  ) {
    return this.camerasService.setDynamicSampleFps(id, sampleFps || 2.0);
  }

  @Get(':id/health')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cameras:read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get real-time health and last 1-hour time-series samples for uptime chart' })
  async getCameraHealth(@Param('id') id: string) {
    return this.camerasService.getHealthHistory(id);
  }

  @Get(':id/snapshot')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cameras:view_live')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retrieve on-demand snapshot frame JPEG' })
  async getCameraSnapshot(@Param('id') id: string) {
    return this.camerasService.getSnapshot(id);
  }

  @Get(':id/playback-token')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cameras:view_recordings')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mint short-lived 60-second read token for WebRTC (WHEP) or HLS playback' })
  async getPlaybackToken(@Param('id') id: string, @Req() req: any) {
    const viewerId = req.user?.id || req.user?.email || 'operator';
    return this.camerasService.generatePlaybackToken(id, viewerId);
  }

  // ─── Realtime Health Ingest & Tracks (internal service endpoints) ──
  @Post('health')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ingest camera health telemetry pulse (service token or JWT)' })
  async recordHealth(@Body() body: any) {
    return this.camerasService.updateCameraHealth(body);
  }

  @Post('tracks/telemetry')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ingest ByteTrack person track telemetry for spatial indexing' })
  async recordTrackTelemetry(@Body() body: any) {
    await this.camerasService.recordTrack(body);
    return { success: true };
  }

  @Get('tracks/nearby')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cameras:read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Query active tracks situated within radius via Redis GEO' })
  async getNearbyTracks(
    @Query('lat') lat: number,
    @Query('lng') lng: number,
    @Query('radiusM', new ParseIntPipe({ optional: true })) radiusM = 50,
    @Query('siteId') siteId?: string,
  ) {
    return this.camerasService.getNearbyTracks(Number(lat), Number(lng), radiusM, siteId);
  }

  // ─── Phase C3: Storage, Playback & Evidentiary Retentions ──────────
  @Post(':id/segments')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Index a newly uploaded video segment in MongoDB (service-to-service)' })
  async recordSegment(
    @Param('id') id: string,
    @Body() dto: CreateVideoSegmentDto,
  ) {
    dto.cameraId = id;
    return this.camerasService.recordSegment(dto);
  }

  @Get(':id/timeline')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cameras:view_recordings')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get playback timeline intervals, gaps, and motion markers' })
  async getTimeline(
    @Param('id') id: string,
    @Query('from') fromStr?: string,
    @Query('to') toStr?: string,
  ) {
    const from = fromStr ? new Date(fromStr) : new Date(Date.now() - 3600 * 1000);
    const to = toStr ? new Date(toStr) : new Date();
    return this.playbackService.getTimeline(id, from, to);
  }

  @Get(':id/playback/playlist.m3u8')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cameras:view_recordings')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Serve dynamic HLS VOD playlist generated on the fly from indexed segments' })
  async getHlsPlaylist(
    @Param('id') id: string,
    @Res() res: Response,
    @Query('from') fromStr?: string,
    @Query('to') toStr?: string,
  ) {
    const from = fromStr ? new Date(fromStr) : undefined;
    const to = toStr ? new Date(toStr) : undefined;
    const playlist = await this.playbackService.generateHlsPlaylist(id, from, to);
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(playlist);
  }

  @Post(':id/clips/export')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('evidence:export')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Export watermarked video clip with optional face blur' })
  async exportClip(
    @Param('id') id: string,
    @Body() dto: ExportClipDto,
    @Req() req: any,
  ) {
    const userEmail = req.user?.email || 'investigator@sentinel.gov';
    return this.playbackService.exportClip(id, dto, userEmail);
  }

  @Post(':id/event-clip')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('sightings:decide')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cut candidate sighting event clip (-10s to +20s) and put under case legal hold' })
  async createEventClip(
    @Param('id') id: string,
    @Body() dto: CreateEventClipDto,
  ) {
    return this.playbackService.createEventClip(id, dto);
  }

  @Get('storage/report')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('retention:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get per-camera storage breakdown report (Hot, Warm, Evidence tiers)' })
  async getStorageReport() {
    return this.storageLifecycleService.getStorageReport();
  }
}
