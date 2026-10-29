export class MobileTelemetryDto {
  battery?: number;
  charging?: boolean;
  networkType?: string;
  rttMs?: number;
  bitrateKbps?: number;
  fps?: number;
  latitude?: number;
  longitude?: number;
  altitude?: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  timestamp?: string;
  coordinates?: [number, number];
}

export class ClockSyncRequestDto {
  t1?: number;
  clientSendTs?: number;
  reportedOffsetMs?: number;
}
