import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({ description: 'One-time email verification token' })
  @IsString()
  @IsNotEmpty()
  token: string;
}

export class ResendVerificationDto {
  @ApiProperty({ example: 'investigator@sentinel.gov' })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'investigator@sentinel.gov' })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: 'One-time password reset token' })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({ description: 'New account password (min 10 chars, zxcvbn score >= 3)' })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  newPassword: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @ApiProperty({ description: 'New account password' })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  newPassword: string;
}

export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  fullName?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  avatarUrl?: string;
}

export class MfaVerifyDto {
  @ApiProperty({ example: '123456' })
  @IsString()
  @IsNotEmpty()
  code: string;
}

export class ApproveUserDto {
  @ApiProperty({ example: 'investigator', enum: ['super_admin', 'investigator', 'reviewer', 'viewer', 'mobile_operator'] })
  @IsString()
  @IsNotEmpty()
  role: string;
}

export class RejectUserDto {
  @ApiPropertyOptional({ example: 'Clearance verification failed' })
  @IsString()
  @IsOptional()
  reason?: string;
}

export class CreateInviteDto {
  @ApiProperty({ example: 'investigator' })
  @IsString()
  @IsNotEmpty()
  role: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  maxUses?: number;

  @ApiPropertyOptional({ example: 7 })
  @IsOptional()
  expiresInDays?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  autoApprove?: boolean;

  @ApiPropertyOptional({ example: ['East Gate Team'] })
  @IsOptional()
  teams?: string[];
}
