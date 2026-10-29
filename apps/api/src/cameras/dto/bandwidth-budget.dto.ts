import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, IsOptional, Min, Max } from 'class-validator';

export class BandwidthEstimateDto {
  @ApiProperty({ description: 'Number of active cameras', default: 24 })
  @IsNumber()
  @Min(1)
  @Max(10000)
  cameraCount: number;

  @ApiProperty({ description: 'Average camera bitrate in kbps', default: 2500 })
  @IsNumber()
  @Min(200)
  @Max(50000)
  avgBitrateKbps: number;

  @ApiProperty({ description: 'Recording mode', default: 'continuous', enum: ['continuous', 'motion', 'event_only', 'off'] })
  @IsString()
  recordMode: string;

  @ApiProperty({ description: 'Retention period in days', default: 30 })
  @IsNumber()
  @Min(1)
  @Max(3650)
  retentionDays: number;
}
