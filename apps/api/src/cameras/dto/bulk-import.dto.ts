import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BulkImportDto {
  @ApiProperty({
    description: 'Raw CSV text containing camera records: name,rtspUrl,latitude,longitude,siteId,floor,buildingId',
    example: 'name,rtspUrl,latitude,longitude,siteId\nGate 1,rtsp://192.168.1.10/live,17.385,78.486,site_primary',
  })
  @IsString()
  @IsNotEmpty()
  csvData: string;

  @ApiPropertyOptional({ description: 'If true, parses and validates without committing to database', default: true })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean = true;
}
