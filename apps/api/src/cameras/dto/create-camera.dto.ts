import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  ValidateNested,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SourceType, MountingType, RecordMode, RecordQuality } from '../schemas/camera.schema';

export class AiPolicyDto {
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean = true;

  @ApiPropertyOptional({ default: 2.0 })
  @IsOptional()
  @IsNumber()
  sampleFps?: number = 2.0;

  @ApiPropertyOptional({ default: 0.65 })
  @IsOptional()
  @IsNumber()
  minDetectionConf?: number = 0.65;
}

export class RecordPolicyDto {
  @ApiPropertyOptional({ enum: ['continuous', 'motion', 'event_only', 'off'], default: 'continuous' })
  @IsOptional()
  @IsString()
  mode?: RecordMode = 'continuous';

  @ApiPropertyOptional({ default: 15 })
  @IsOptional()
  @IsNumber()
  segmentSec?: number = 15;

  @ApiPropertyOptional({ default: 30 })
  @IsOptional()
  @IsNumber()
  retentionDays?: number = 30;

  @ApiPropertyOptional({ enum: ['original', 'economy'], default: 'original' })
  @IsOptional()
  @IsString()
  quality?: RecordQuality = 'original';
}

export class CameraAuthorizationDto {
  @ApiProperty({ description: 'Mandatory surveillance consent affirmation', example: true })
  @IsBoolean()
  consentConfirmed: boolean;

  @ApiPropertyOptional({ description: 'Authorized officer', default: 'Chief Inspector' })
  @IsOptional()
  @IsString()
  authorizedBy?: string;

  @ApiPropertyOptional({ description: 'Specific investigative purpose' })
  @IsOptional()
  @IsString()
  purpose?: string;

  @ApiPropertyOptional({ description: 'Legal statutory warrant / note' })
  @IsOptional()
  @IsString()
  legalBasisNote?: string;
}

export class CreateCameraDto {
  @ApiPropertyOptional({ description: 'Unique camera ID, e.g. cam_042 (auto-generated if omitted)' })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ description: 'Human-readable camera name', example: 'North Terminal Entrance Gate 4' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Location label', example: 'Terminal North Gate' })
  @IsOptional()
  @IsString()
  locationName?: string;

  @ApiPropertyOptional({ description: 'Associated facility site', default: 'site_primary' })
  @IsOptional()
  @IsString()
  siteId?: string = 'site_primary';

  @ApiPropertyOptional({ description: 'Associated building ID', default: 'bld_central' })
  @IsOptional()
  @IsString()
  buildingId?: string = 'bld_central';

  @ApiPropertyOptional({ description: 'Vertical floor level', default: 1 })
  @IsOptional()
  @IsNumber()
  floor?: number = 1;

  @ApiProperty({ enum: SourceType, default: SourceType.CCTV_RTSP })
  @IsEnum(SourceType)
  sourceType: SourceType = SourceType.CCTV_RTSP;

  @ApiProperty({ description: 'Coordinates as [longitude, latitude]', example: [78.4867, 17.385] })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  @IsNumber({}, { each: true })
  coordinates: [number, number];

  @ApiPropertyOptional({ description: 'Compass orientation heading (0-360 deg)', default: 0 })
  @IsOptional()
  @IsNumber()
  headingDeg?: number = 0;

  @ApiPropertyOptional({ description: 'Horizontal field-of-view angle (deg)', default: 75 })
  @IsOptional()
  @IsNumber()
  fovDeg?: number = 75;

  @ApiPropertyOptional({ description: 'Optical range in meters', default: 35 })
  @IsOptional()
  @IsNumber()
  rangeM?: number = 35;

  @ApiPropertyOptional({ enum: ['fixed', 'mobile'], default: 'fixed' })
  @IsOptional()
  @IsString()
  mounting?: MountingType = 'fixed';

  @ApiPropertyOptional({ description: 'Whether camera is movable', default: false })
  @IsOptional()
  @IsBoolean()
  isMovable?: boolean = false;

  @ApiPropertyOptional({ description: 'RTSP pull stream URL (required for cctv_rtsp and cctv_onvif)' })
  @IsOptional()
  @IsString()
  rtspUrl?: string;

  @ApiPropertyOptional({ type: AiPolicyDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AiPolicyDto)
  aiPolicy?: AiPolicyDto;

  @ApiPropertyOptional({ type: RecordPolicyDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => RecordPolicyDto)
  recordPolicy?: RecordPolicyDto;

  @ApiProperty({ type: CameraAuthorizationDto, description: 'Surveillance authorization & consent compliance' })
  @ValidateNested()
  @Type(() => CameraAuthorizationDto)
  authorization: CameraAuthorizationDto;
}
