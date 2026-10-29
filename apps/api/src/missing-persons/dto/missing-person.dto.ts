import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  IsIn,
  ValidateNested,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MissingPersonPriority, MissingPersonStatus } from '../schemas/missing-person.schema';

export class GeoPointDto {
  @ApiPropertyOptional({ example: 'Point', default: 'Point' })
  @IsOptional()
  @IsString()
  type: 'Point' = 'Point';

  @ApiProperty({ example: [78.4867, 17.385] })
  @IsArray()
  coordinates: [number, number]; // [lng, lat]
}

export class ApproxAgeRangeDto {
  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @IsNumber()
  min?: number;

  @ApiPropertyOptional({ example: 16 })
  @IsOptional()
  @IsNumber()
  max?: number;
}

export class PersonIdentityDto {
  @ApiProperty({ example: 'Maya Chen' })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({ example: ['May', 'Little M'] })
  @IsOptional()
  @IsArray()
  aliases?: string[];

  @ApiPropertyOptional({ example: 'female', enum: ['male', 'female', 'other', 'unknown'] })
  @IsOptional()
  @IsIn(['male', 'female', 'other', 'unknown'])
  gender?: string;

  @ApiPropertyOptional({ example: '2012-05-14' })
  @IsOptional()
  @IsString()
  dob?: string;

  @ApiPropertyOptional({ type: ApproxAgeRangeDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ApproxAgeRangeDto)
  approxAgeRange?: ApproxAgeRangeDto;

  @ApiPropertyOptional({ example: 'US' })
  @IsOptional()
  @IsString()
  nationality?: string;

  @ApiPropertyOptional({ example: ['English', 'Mandarin'] })
  @IsOptional()
  @IsArray()
  languages?: string[];
}

export class PersonPhysicalDto {
  @ApiPropertyOptional({ example: 155 })
  @IsOptional()
  @IsNumber()
  heightCm?: number;

  @ApiPropertyOptional({ example: 'slender' })
  @IsOptional()
  @IsString()
  build?: string;

  @ApiPropertyOptional({ example: 'black, shoulder length' })
  @IsOptional()
  @IsString()
  hair?: string;

  @ApiPropertyOptional({ example: 'brown' })
  @IsOptional()
  @IsString()
  eyes?: string;

  @ApiPropertyOptional({ example: 'fair' })
  @IsOptional()
  @IsString()
  skinTone?: string;

  @ApiPropertyOptional({ example: ['small scar above left eyebrow'] })
  @IsOptional()
  @IsArray()
  distinguishingMarks?: string[];

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  glasses?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  beard?: boolean;
}

export class PersonVulnerabilityDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isMinor?: boolean;

  @ApiPropertyOptional({ example: 'Requires daily anti-asthma inhaler' })
  @IsOptional()
  @IsString()
  medicalNotes?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  mentalHealthFlag?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  requiresUrgentPriority?: boolean;
}

export class LastSeenRecordDto {
  @ApiPropertyOptional({ example: '2026-10-28T09:15:00Z' })
  @IsOptional()
  @IsString()
  ts?: string;

  @ApiProperty({ example: 'Terminal 2 Concourse, Central Station' })
  @IsOptional()
  @IsString()
  locationText?: string;

  @ApiPropertyOptional({ type: GeoPointDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => GeoPointDto)
  coordinates?: GeoPointDto;

  @ApiPropertyOptional({ example: 'cam_central_01' })
  @IsOptional()
  @IsString()
  cameraId?: string;

  @ApiPropertyOptional({ example: 'East towards Platform 4' })
  @IsOptional()
  @IsString()
  direction?: string;

  @ApiPropertyOptional({ example: 'Alone' })
  @IsOptional()
  @IsString()
  accompaniedBy?: string;

  @ApiPropertyOptional({ example: 'Alighted from southbound express train' })
  @IsOptional()
  @IsString()
  circumstances?: string;
}

export class ClothingItemDto {
  @ApiProperty({ example: 'hoodie' })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty({ example: 'yellow' })
  @IsString()
  @IsNotEmpty()
  colour: string;

  @ApiPropertyOptional({ example: 'solid' })
  @IsOptional()
  @IsString()
  pattern?: string;

  @ApiPropertyOptional({ example: 'Adidas' })
  @IsOptional()
  @IsString()
  brand?: string;
}

export class ClothingAccessoryDto {
  @ApiProperty({ example: 'backpack' })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty({ example: 'teal' })
  @IsString()
  @IsNotEmpty()
  colour: string;
}

export class LastSeenClothingDto {
  @ApiPropertyOptional({ type: [ClothingItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClothingItemDto)
  items?: ClothingItemDto[];

  @ApiPropertyOptional({ type: [ClothingAccessoryDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClothingAccessoryDto)
  accessories?: ClothingAccessoryDto[];

  @ApiPropertyOptional({ example: 'white sneakers' })
  @IsOptional()
  @IsString()
  footwear?: string;

  @ApiPropertyOptional({ example: ['blue water bottle'] })
  @IsOptional()
  @IsArray()
  carriedItems?: string[];
}

export class PersonReporterDto {
  @ApiProperty({ example: 'David Chen' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ example: 'Father' })
  @IsOptional()
  @IsString()
  relation?: string;

  @ApiPropertyOptional({ example: '+1-555-019-2834' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'd.chen@example.com' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ example: 'phone', enum: ['phone', 'email', 'in_person'] })
  @IsOptional()
  @IsIn(['phone', 'email', 'in_person'])
  contactPreference?: string;
}

export class PersonAuthorityDto {
  @ApiProperty({ example: 'FIR-2026-99214' })
  @IsOptional()
  @IsString()
  reportNumber?: string;

  @ApiPropertyOptional({ example: 'Metro Central Precinct' })
  @IsOptional()
  @IsString()
  station?: string;

  @ApiPropertyOptional({ example: 'Det. Sarah Vance' })
  @IsOptional()
  @IsString()
  officerName?: string;

  @ApiPropertyOptional({ example: 'Capt. Marcus Reed' })
  @IsOptional()
  @IsString()
  authorizedBy?: string;

  @ApiPropertyOptional({ example: '2026-10-28T09:00:00Z' })
  @IsOptional()
  @IsString()
  authorizedAt?: string;

  @ApiPropertyOptional({ example: 'Missing Persons Protection Act 2024' })
  @IsOptional()
  @IsString()
  legalBasisNote?: string;
}

export class SearchPolicyDto {
  @ApiPropertyOptional({ example: 0.75 })
  @IsOptional()
  @IsNumber()
  defaultMinConfidence?: number;

  @ApiPropertyOptional({ example: 24 })
  @IsOptional()
  @IsNumber()
  defaultTimeWindowHours?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  autoSearchOnUpdate?: boolean;
}

export class CreateMissingPersonDto {
  @ApiPropertyOptional({ example: 'case_507f1f77bcf86cd799439011' })
  @IsOptional()
  @IsString()
  caseId?: string;

  @ApiPropertyOptional({ example: 'draft', enum: ['draft', 'active'] })
  @IsOptional()
  @IsIn(['draft', 'active'])
  status?: MissingPersonStatus;

  @ApiPropertyOptional({ type: PersonIdentityDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PersonIdentityDto)
  identity?: PersonIdentityDto;

  @ApiPropertyOptional({ type: PersonPhysicalDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PersonPhysicalDto)
  physical?: PersonPhysicalDto;

  @ApiPropertyOptional({ type: PersonVulnerabilityDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PersonVulnerabilityDto)
  vulnerability?: PersonVulnerabilityDto;

  @ApiPropertyOptional({ type: LastSeenRecordDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LastSeenRecordDto)
  lastSeen?: LastSeenRecordDto;

  @ApiPropertyOptional({ type: LastSeenClothingDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LastSeenClothingDto)
  lastSeenClothing?: LastSeenClothingDto;

  @ApiPropertyOptional({ type: PersonReporterDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PersonReporterDto)
  reporter?: PersonReporterDto;

  @ApiPropertyOptional({ type: PersonAuthorityDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PersonAuthorityDto)
  authority?: PersonAuthorityDto;

  @ApiPropertyOptional({ example: 'high', enum: ['low', 'medium', 'high', 'critical'] })
  @IsOptional()
  @IsIn(['low', 'medium', 'high', 'critical'])
  priority?: MissingPersonPriority;

  @ApiPropertyOptional({ type: SearchPolicyDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SearchPolicyDto)
  searchPolicy?: SearchPolicyDto;
}

export class UpdateMissingPersonDto extends CreateMissingPersonDto {}

export class NewLastSeenDto {
  @ApiProperty({ example: '2026-10-28T12:00:00Z' })
  @IsString()
  @IsNotEmpty()
  ts: string;

  @ApiProperty({ example: 'North Gate Bus Stop, Sector 8' })
  @IsString()
  @IsNotEmpty()
  locationText: string;

  @ApiProperty({ type: GeoPointDto })
  @ValidateNested()
  @Type(() => GeoPointDto)
  coordinates: GeoPointDto;

  @ApiPropertyOptional({ example: 'cam_bus_08' })
  @IsOptional()
  @IsString()
  cameraId?: string;

  @ApiPropertyOptional({ example: 'Northwest' })
  @IsOptional()
  @IsString()
  direction?: string;

  @ApiPropertyOptional({ example: 'Seen talking to unidentified subject' })
  @IsOptional()
  @IsString()
  circumstances?: string;

  @ApiPropertyOptional({ example: 'CCTV review' })
  @IsOptional()
  @IsString()
  source?: string;
}

export class UpdateStatusDto {
  @ApiProperty({
    example: 'found',
    enum: ['draft', 'active', 'under_verification', 'found', 'closed', 'suspended'],
  })
  @IsIn(['draft', 'active', 'under_verification', 'found', 'closed', 'suspended'])
  status: MissingPersonStatus;

  @ApiProperty({ example: 'Safely located at maternal relatives residence' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
