import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsNumber,
  Min,
  Max,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TriggerSearchDto {
  @ApiProperty({ example: 'case_01' })
  @IsString()
  @IsNotEmpty()
  caseId: string;

  @ApiProperty({ example: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=600' })
  @IsString()
  @IsNotEmpty()
  referencePhotoUrl: string;

  @ApiPropertyOptional({ example: ['cam_01', 'cam_02'], type: [String] })
  @IsOptional()
  @IsArray()
  cameraScope?: string[];

  @ApiPropertyOptional({ example: 24 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(168)
  timeRangeHours?: number;

  @ApiPropertyOptional({ example: 0.75 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  minConfidence?: number;
}
