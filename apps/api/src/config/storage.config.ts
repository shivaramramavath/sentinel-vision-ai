import { registerAs } from '@nestjs/config';

export const storageConfig = registerAs('storage', () => ({
  driver: (process.env.STORAGE_DRIVER ?? 'cloudinary') as 'cloudinary' | 'minio',
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? '',
    apiKey: process.env.CLOUDINARY_API_KEY ?? '',
    apiSecret: process.env.CLOUDINARY_API_SECRET ?? '',
    url: process.env.CLOUDINARY_URL ?? '',
    rootFolder: process.env.CLOUDINARY_ROOT_FOLDER ?? 'sentinel/dev',
    signedUrlTtlSeconds: parseInt(process.env.CLOUDINARY_SIGNED_URL_TTL_SECONDS ?? '300', 10),
    notificationUrl: process.env.CLOUDINARY_NOTIFICATION_URL ?? '',
    maxImageMb: parseInt(process.env.CLOUDINARY_MAX_IMAGE_MB ?? '25', 10),
    maxVideoMb: parseInt(process.env.CLOUDINARY_MAX_VIDEO_MB ?? '100', 10),
  },
  recordingDriver: (process.env.RECORDING_DRIVER ?? 'minio') as 'minio' | 'local' | 'off',
}));
