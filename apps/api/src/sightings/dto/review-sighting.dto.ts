import { IsIn, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SightingReviewStatus } from '../schemas/sighting.schema';

export class ReviewSightingDto {
  @ApiProperty({
    example: 'confirmed',
    enum: ['confirmed', 'rejected', 'need_evidence'],
  })
  @IsIn(['confirmed', 'rejected', 'need_evidence'])
  status: SightingReviewStatus;

  @ApiPropertyOptional({ example: 'Subject clothing matches last seen description' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    example: 'different_person',
    enum: [
      'different_person',
      'clothing_mismatch',
      'poor_lighting',
      'occlusion',
      'insufficient_resolution',
      'other',
    ],
  })
  @IsOptional()
  @IsIn([
    'different_person',
    'clothing_mismatch',
    'poor_lighting',
    'occlusion',
    'insufficient_resolution',
    'other',
  ])
  rejectReasonCode?: string;
}
