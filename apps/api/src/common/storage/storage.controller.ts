import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Req,
  Res,
  Headers,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { StorageService } from './storage.service';
import { InternalServiceGuard } from '../guards/internal-service.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../rbac/guards/permissions.guard';
import { RequirePermissions } from '../decorators/require-permissions.decorator';
import { KafkaService } from '../kafka/kafka.service';
import { randomUUID } from 'crypto';

@ApiTags('Storage & Media')
@Controller()
export class StorageController {
  constructor(
    private readonly storageService: StorageService,
    private readonly kafkaService: KafkaService,
  ) {}

  @Get('internal/media/:assetId/original')
  @UseGuards(InternalServiceGuard)
  @ApiOperation({ summary: 'Internal stream access for AI workers and hash verification (Service token authenticated)' })
  async getOriginalStream(
    @Param('assetId') assetId: string,
    @Res() res: Response,
  ) {
    const { stream, asset } = await this.storageService.getOriginalStream(assetId);

    res.setHeader('Content-Type', `image/${asset.format}`.replace('image/mp4', 'video/mp4'));
    res.setHeader('x-sha256', asset.sha256);
    res.setHeader('x-asset-id', asset.assetId);
    res.setHeader('x-public-id', asset.publicId);

    stream.pipe(res);
  }

  @Post('internal/evidence')
  @UseGuards(InternalServiceGuard)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiOperation({ summary: 'Inference worker evidence upload: API normalizes, hashes, and stores asset without workers needing credentials' })
  async uploadInternalEvidence(
    @UploadedFile() file?: Express.Multer.File,
    @Body() body?: any,
  ) {
    let buffer: Buffer;
    let mimeType: string;

    if (file) {
      buffer = file.buffer;
      mimeType = file.mimetype;
    } else if (body?.dataBase64) {
      buffer = Buffer.from(body.dataBase64, 'base64');
      mimeType = body.mimeType || 'image/jpeg';
    } else {
      throw new BadRequestException('No file buffer or dataBase64 provided');
    }

    const kind = body?.kind || 'frame';
    const caseId = body?.caseId || 'unassigned';
    const entityId = body?.entityId || `ev_${randomUUID().substring(0, 12)}`;

    const asset = await this.storageService.upload({
      buffer,
      kind,
      caseId,
      entityId,
      mimeType,
      uploadedBy: 'inference-worker',
      context: {
        caseId,
        cameraId: body?.cameraId,
        capturedAt: body?.capturedAt || new Date().toISOString(),
        sightingId: body?.sightingId,
      },
      tags: body?.tags || [],
      legalHold: body?.legalHold === true || body?.legalHold === 'true',
    });

    // Emit Kafka evidence.created event
    try {
      await this.kafkaService.publishEvent('evidence.created', {
        eventId: randomUUID(),
        type: 'evidence.created',
        occurredAt: new Date().toISOString(),
        correlationId: `corr_${Date.now()}`,
        version: '1.0',
        caseId,
        payload: {
          evidenceId: entityId,
          assetId: asset.assetId,
          publicId: asset.publicId,
          sha256: asset.sha256,
          kind,
          cameraId: body?.cameraId,
          capturedAt: body?.capturedAt || new Date().toISOString(),
          sightingId: body?.sightingId,
        },
      });
    } catch {
      // Non-blocking Kafka emit
    }

    const { url } = await this.storageService.getSignedUrl(asset.assetId, { purpose: 'view' });

    return {
      assetId: asset.assetId,
      publicId: asset.publicId,
      sha256: asset.sha256,
      bytes: asset.bytes,
      url,
    };
  }

  @Post('webhooks/cloudinary')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cloudinary asynchronous notification webhook' })
  async handleCloudinaryWebhook(
    @Body() payload: any,
    @Headers('x-cld-signature') signature?: string,
    @Headers('x-cld-timestamp') timestamp?: string,
  ) {
    // Cloudinary webhook event processed
    return { status: 'ok', receivedAt: new Date().toISOString() };
  }

  @Get('media/assets/:id/signed-url')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtain temporary signed delivery URL for an authenticated asset' })
  async getSignedUrl(
    @Param('id') id: string,
    @Query('purpose') purpose: 'view' | 'download' | 'inference' | 'thumbnail' = 'view',
    @Query('ttl') ttl?: string,
    @Query('transform') transform?: string,
    @Req() req?: any,
  ) {
    const actor = req?.user;
    const ttlSeconds = ttl ? parseInt(ttl, 10) : undefined;
    const result = await this.storageService.getSignedUrl(
      id,
      { purpose, ttlSeconds, transform },
      actor,
    );

    return {
      url: result.url,
      expiresAt: result.expiresAt,
      assetId: result.asset.assetId,
      publicId: result.asset.publicId,
    };
  }

  @Get('storage/usage')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('admin:system')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get storage usage and plan quotas' })
  async getUsage() {
    return this.storageService.usage();
  }
}
