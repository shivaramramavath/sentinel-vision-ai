import { IsString, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MediaAuthDto {
  @ApiPropertyOptional({ description: 'Client IP address' })
  @IsOptional()
  @IsString()
  ip?: string;

  @ApiPropertyOptional({ description: 'Username provided by client' })
  @IsOptional()
  @IsString()
  user?: string;

  @ApiPropertyOptional({ description: 'Password or stream key provided by client' })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiProperty({ description: 'Stream path requested, e.g. cam/cam_001' })
  @IsString()
  path: string;

  @ApiPropertyOptional({ description: 'Protocol used (rtsp, rtmp, webrtc, srt, hls)' })
  @IsOptional()
  @IsString()
  protocol?: string;

  @ApiPropertyOptional({ description: 'Internal MediaMTX connection ID' })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ description: 'Action being attempted (publish or read)', enum: ['publish', 'read', 'playback', 'api', 'metrics', 'pprof'] })
  @IsString()
  @IsIn(['publish', 'read', 'playback', 'api', 'metrics', 'pprof'])
  action: string;

  @ApiPropertyOptional({ description: 'Query parameters from stream URL, e.g. key=xyz&token=abc' })
  @IsOptional()
  @IsString()
  query?: string;
}

export class StreamStatusHookDto {
  @ApiProperty({ description: 'Stream path, e.g. cam/cam_001' })
  @IsString()
  path: string;

  @ApiProperty({ description: 'Captured camera identifier, e.g. cam_001' })
  @IsString()
  cameraId: string;

  @ApiProperty({ description: 'Stream lifecycle status', enum: ['READY', 'NOT_READY'] })
  @IsString()
  @IsIn(['READY', 'NOT_READY'])
  status: 'READY' | 'NOT_READY';

  @ApiPropertyOptional({ description: 'Source type, e.g. publisher' })
  @IsOptional()
  @IsString()
  sourceType?: string;

  @ApiPropertyOptional({ description: 'Source connection ID' })
  @IsOptional()
  @IsString()
  sourceId?: string;
}
