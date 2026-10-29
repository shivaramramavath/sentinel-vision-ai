import { z } from 'zod';
import { CameraStatus } from '../enums';

export const CameraLocationSchema = z.object({
  label: z.string().max(200),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  building: z.string().max(200).optional(),
  floor: z.string().max(50).optional(),
});

export const CreateCameraSchema = z.object({
  name: z.string().min(1).max(200),
  rtspUrl: z.string().url().startsWith('rtsp://'),
  location: CameraLocationSchema,
  description: z.string().max(500).optional(),
  frameRateFps: z.number().int().min(1).max(60).default(5),
  resolutionWidth: z.number().int().min(1).optional(),
  resolutionHeight: z.number().int().min(1).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

export const UpdateCameraSchema = CreateCameraSchema.partial().extend({
  status: z.nativeEnum(CameraStatus).optional(),
});

export const CameraSchema = CreateCameraSchema.extend({
  id: z.string(),
  status: z.nativeEnum(CameraStatus).default(CameraStatus.INACTIVE),
  lastSeenAt: z.coerce.date().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type CameraLocation = z.infer<typeof CameraLocationSchema>;
export type CreateCameraDto = z.infer<typeof CreateCameraSchema>;
export type UpdateCameraDto = z.infer<typeof UpdateCameraSchema>;
export type Camera = z.infer<typeof CameraSchema>;
