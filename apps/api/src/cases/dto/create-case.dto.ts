import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsIn,
  Min,
  IsArray,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CasePriority, CaseStatus } from '../schemas/case.schema';

export class CreateCaseDto {
  @ApiProperty({ example: 'Search for Maya Chen' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'Maya Chen' })
  @IsString()
  @IsNotEmpty()
  personName: string;

  @ApiProperty({ example: 14 })
  @IsNumber()
  @Min(0)
  age: number;

  @ApiProperty({ example: 'female' })
  @IsString()
  @IsIn(['male', 'female', 'other', 'unknown'])
  gender: string;

  @ApiProperty({ example: 'Terminal 2, Metro Station' })
  @IsString()
  @IsNotEmpty()
  lastSeenLocation: string;

  @ApiPropertyOptional({ example: '2026-10-28T09:15:00Z' })
  @IsOptional()
  @IsString()
  lastSeenAt?: string;

  @ApiPropertyOptional({ example: 'high', enum: ['critical', 'high', 'medium', 'low'] })
  @IsOptional()
  @IsIn(['critical', 'high', 'medium', 'low'])
  priority?: CasePriority;

  @ApiPropertyOptional({ example: 'Yellow hoodie, dark jeans, white sneakers' })
  @IsOptional()
  @IsString()
  lastSeenWearing?: string;

  @ApiPropertyOptional({ example: 'Missing after alighting from southbound train' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'Insp. Sarah Vance' })
  @IsOptional()
  @IsString()
  assignedOfficer?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  accessList?: string[];

  // Minor / Vulnerable person flags
  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isVulnerable?: boolean;

  @ApiPropertyOptional({ example: 'Requires regular asthma medication' })
  @IsOptional()
  @IsString()
  vulnerabilityDetails?: string;

  // Statutory Authorization & Consent
  @ApiPropertyOptional({ example: 'David Chen' })
  @IsOptional()
  @IsString()
  reporterName?: string;

  @ApiPropertyOptional({ example: 'Parent/Guardian' })
  @IsOptional()
  @IsString()
  reporterRelationship?: string;

  @ApiPropertyOptional({ example: '+1-555-019-2834' })
  @IsOptional()
  @IsString()
  reporterPhone?: string;

  @ApiPropertyOptional({ example: 'Metropolitan Police Dept - Juvenile Bureau' })
  @IsOptional()
  @IsString()
  authorityName?: string;

  @ApiPropertyOptional({ example: 'FIR-2026-883921' })
  @IsOptional()
  @IsString()
  firOrCaseNumber?: string;

  @ApiPropertyOptional({ example: 'BADGE-4421' })
  @IsOptional()
  @IsString()
  officerBadge?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  consentConfirmed?: boolean;

  @ApiPropertyOptional({ example: 'Statutory duty under Missing Persons Protection Act 2024' })
  @IsOptional()
  @IsString()
  legalBasis?: string;

  // Sensitive PII (Encrypted at rest)
  @ApiPropertyOptional({ example: 'SSN-998-12-4412' })
  @IsOptional()
  @IsString()
  nationalId?: string;

  @ApiPropertyOptional({ example: '+1-555-018-9922' })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiPropertyOptional({ example: '742 Evergreen Terrace, Sector 4' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 'Severe peanut allergy, type 1 diabetic' })
  @IsOptional()
  @IsString()
  medicalNotes?: string;
}

export class UpdateCaseStatusDto {
  @ApiProperty({ example: 'resolved', enum: ['active', 'resolved', 'archived'] })
  @IsIn(['active', 'resolved', 'archived'])
  status: CaseStatus;
}
