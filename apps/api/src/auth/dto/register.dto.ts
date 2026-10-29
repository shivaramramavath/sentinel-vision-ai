import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'Insp. Sarah Vance' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: 'sarah.vance@sentinel.gov' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'SecureP@ssword2026!' })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  password: string;

  @ApiPropertyOptional({ example: 'INV-4821-X9' })
  @IsString()
  @IsOptional()
  inviteCode?: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  consent: boolean;

  @ApiPropertyOptional({ example: 'turnstile_token_xyz' })
  @IsString()
  @IsOptional()
  captchaToken?: string;
}
