import { registerAs } from '@nestjs/config';

export const mediaConfig = registerAs('media', () => ({
  baseUrl: process.env.MEDIA_BASE_URL ?? 'http://localhost:8889',
  hlsUrl: process.env.MEDIA_HLS_URL ?? 'http://localhost:8888',
  rtspUrl: process.env.MEDIA_RTSP_URL ?? 'rtsp://localhost:8554',
  apiUrl: process.env.MEDIA_API_URL ?? 'http://localhost:9997',
  stunUrls: (process.env.STUN_URLS ?? 'stun:stun.l.google.com:19302')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  turnUrls: (process.env.TURN_URLS ?? 'turn:localhost:3478')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  turnSecret: process.env.TURN_SECRET ?? '',
  turnCredentialTtlSeconds: parseInt(process.env.TURN_CREDENTIAL_TTL_SECONDS ?? '600', 10),
}));
