import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsIn,
  ValidateNested,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReferenceImageType, ReferenceSource } from '../schemas/reference-image.schema';

export class BoundingBoxDto {
  @ApiProperty({ example: 120 })
  @IsNumber()
  x: number;

  @ApiProperty({ example: 80 })
  @IsNumber()
  y: number;

  @ApiProperty({ example: 240 })
  @IsNumber()
  width: number;

  @ApiProperty({ example: 320 })
  @IsNumber()
  height: number;
}

export class PresignReferenceUploadDto {
  @ApiProperty({ example: 'face_front' })
  @IsString()
  @IsNotEmpty()
  type: ReferenceImageType;

  @ApiProperty({ example: 'image/jpeg', enum: ['image/jpeg', 'image/png', 'image/webp', 'image/heic'] })
  @IsString()
  @IsIn(['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
  contentType: string;

  @ApiProperty({ example: 4500000, description: 'File size in bytes (max 15 MB)' })
  @IsNumber()
  @Max(15 * 1024 * 1024)
  fileSize: number;

  @ApiProperty({ example: 'case_507f1f77bcf86cd799439011' })
  @IsString()
  @IsNotEmpty()
  caseId: string;

  @ApiPropertyOptional({ example: 'mp_44921' })
  @IsOptional()
  @IsString()
  personId?: string;
}

export class RegisterReferenceDto {
  @ApiProperty({ example: 'case_507f1f77bcf86cd799439011' })
  @IsString()
  @IsNotEmpty()
  caseId: string;

  @ApiPropertyOptional({ example: 'mp_44921' })
  @IsOptional()
  @IsString()
  personId?: string;

  @ApiPropertyOptional({ example: 'face_front' })
  @IsOptional()
  @IsString()
  type?: ReferenceImageType;

  @ApiPropertyOptional({ example: 'family_upload' })
  @IsOptional()
  @IsString()
  source?: ReferenceSource;

  @ApiPropertyOptional({ example: '2026-08-15T14:30:00Z' })
  @IsOptional()
  @IsString()
  photoTakenAt?: string;

  @ApiPropertyOptional({ example: 'reference-photos/case_123/ref_abc.jpg' })
  @IsOptional()
  @IsString()
  objectKey?: string;

  @ApiPropertyOptional({ type: BoundingBoxDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => BoundingBoxDto)
  selectedFaceBox?: BoundingBoxDto;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class PatchReferenceDto {
  @ApiPropertyOptional({ example: 'face_profile' })
  @IsOptional()
  @IsString()
  type?: ReferenceImageType;

  @ApiPropertyOptional({ example: '2026-08-15T14:30:00Z' })
  @IsOptional()
  @IsString()
  photoTakenAt?: string;

  @ApiPropertyOptional({ example: 'police' })
  @IsOptional()
  @IsString()
  source?: ReferenceSource;

  @ApiPropertyOptional({ type: BoundingBoxDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => BoundingBoxDto)
  selectedFaceBox?: BoundingBoxDto;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class ReprocessReferenceDto {
  @ApiPropertyOptional({ type: BoundingBoxDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => BoundingBoxDto)
  manualCropBox?: BoundingBoxDto;

  @ApiPropertyOptional({ example: 'Manual crop around subject head to remove background crowd' })
  @IsOptional()
  @IsString()
  notes?: string;
}
