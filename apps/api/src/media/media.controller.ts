import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { MediaService } from './media.service';
import { MediaAuthDto, StreamStatusHookDto } from './dto/media-auth.dto';

@ApiTags('Media & Video Streaming')
@Controller('media')
export class MediaController {
  private readonly logger = new Logger(MediaController.name);

  constructor(private readonly mediaService: MediaService) {}

  @Post('auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'MediaMTX External HTTP Authentication',
    description:
      'Validates publish (camera ingestion) and read (operator playback) permissions for stream paths formatted as cam/{cameraId}',
  })
  @ApiResponse({ status: 200, description: 'Authorization granted' })
  @ApiResponse({ status: 401, description: 'Unauthorized stream key or missing viewer JWT' })
  @ApiResponse({ status: 403, description: 'Invalid path pattern' })
  async authenticate(@Body() dto: MediaAuthDto) {
    return this.mediaService.authenticateMediaRequest(dto);
  }

  @Post('hook/stream-status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'MediaMTX Stream Lifecycle Hook (runOnReady / runOnNotReady)',
    description:
      'Receives stream ready/not-ready triggers from MediaMTX, updates camera health in MongoDB/Redis, and publishes to Kafka',
  })
  @ApiResponse({ status: 200, description: 'Lifecycle event processed' })
  async handleStreamHook(@Body() dto: StreamStatusHookDto) {
    return this.mediaService.handleStreamStatusHook(dto);
  }
}
