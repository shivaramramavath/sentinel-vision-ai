import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsDateString,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateVideoSegmentDto {
  @ApiProperty({ description: 'Surveillance Camera ID', example: 'cam_001' })
  @IsString()
  @IsNotEmpty()
  cameraId: string;

  @ApiPropertyOptional({ default: 'site_primary' })
  @IsOptional()
  @IsString()
  siteId?: string = 'site_primary';

  @ApiProperty({ description: 'Segment start UTC ISO timestamp', example: '2026-10-28T12:00:00.000Z' })
  @IsDateString()
  startTs: string;

  @ApiProperty({ description: 'Segment end UTC ISO timestamp', example: '2026-10-28T12:00:08.000Z' })
  @IsDateString()
  endTs: string;

  @ApiProperty({ description: 'Duration in seconds', example: 8.0 })
  @IsNumber()
  durationSec: number;

  @ApiProperty({ description: 'MinIO S3 storage URI', example: 's3://camera-recordings/site_primary/cam_001/2026/10/28/12/seg_01.mp4' })
  @IsString()
  @IsNotEmpty()
  uri: string;

  @ApiPropertyOptional({ description: 'Keyframe preview thumbnail URI' })
  @IsOptional()
  @IsString()
  thumbnailUri?: string;

  @ApiProperty({ description: 'File size in bytes', example: 2048500 })
  @IsNumber()
  sizeBytes: number;

  @ApiPropertyOptional({ default: 'h264' })
  @IsOptional()
  @IsString()
  codec?: string = 'h264';

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  hasGap?: boolean = false;

  @ApiPropertyOptional({ description: 'Motion score 0.0 - 1.0', default: 0.0 })
  @IsOptional()
  @IsNumber()
  motionScore?: number = 0.0;

  @ApiProperty({ description: 'SHA-256 cryptographic hash', example: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' })
  @IsString()
  @IsNotEmpty()
  checksum: string;

  @ApiPropertyOptional({ enum: ['hot', 'warm', 'evidence'], default: 'hot' })
  @IsOptional()
  @IsIn(['hot', 'warm', 'evidence'])
  tier?: 'hot' | 'warm' | 'evidence' = 'hot';
}

export class ExportClipDto {
  @ApiProperty({ description: 'Start timestamp (ISO)', example: '2026-10-28T12:00:00.000Z' })
  @IsDateString()
  from: string;

  @ApiProperty({ description: 'End timestamp (ISO)', example: '2026-10-28T12:01:30.000Z' })
  @IsDateString()
  to: string;

  @ApiPropertyOptional({ description: 'Optional missing person case ID to link' })
  @IsOptional()
  @IsString()
  caseId?: string;

  @ApiPropertyOptional({ description: 'Apply privacy face-blurring on non-target individuals', default: false })
  @IsOptional()
  @IsBoolean()
  faceBlur?: boolean = false;

  @ApiPropertyOptional({ description: 'Burn-in legal custody watermark header', default: true })
  @IsOptional()
  @IsBoolean()
  watermark?: boolean = true;

  @ApiPropertyOptional({ description: 'Reason for export (chain of custody audit)', example: 'Court evidentiary disclosure' })
  @IsOptional()
  @IsString()
  purpose?: string;
}

export class CreateEventClipDto {
  @ApiProperty({ description: 'Candidate sighting ID', example: 'sighting_991' })
  @IsString()
  @IsNotEmpty()
  sightingId: string;

  @ApiProperty({ description: 'Target sighting timestamp (ISO)', example: '2026-10-28T12:00:15.000Z' })
  @IsDateString()
  sightingTs: string;

  @ApiProperty({ description: 'Missing person case ID', example: 'case_2026_01' })
  @IsString()
  @IsNotEmpty()
  caseId: string;
}
