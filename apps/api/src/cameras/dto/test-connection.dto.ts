import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TestConnectionDto {
  @ApiProperty({ description: 'RTSP or HTTP stream URL to probe', example: 'rtsp://admin:pass@192.168.1.100:554/live' })
  @IsString()
  @IsNotEmpty()
  rtspUrl: string;

  @ApiPropertyOptional({ description: 'Username if not embedded in URL' })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({ description: 'Password if not embedded in URL' })
  @IsOptional()
  @IsString()
  password?: string;
}

export class ConnectionProbeResultDto {
  @ApiProperty()
  reachable: boolean;

  @ApiProperty()
  codec: string;

  @ApiProperty()
  width: number;

  @ApiProperty()
  height: number;

  @ApiProperty()
  fps: number;

  @ApiProperty()
  bitrateKbps: number;

  @ApiProperty()
  hasAudio: boolean;

  @ApiPropertyOptional()
  warning?: string;

  @ApiPropertyOptional()
  snapshotBase64?: string;
}
