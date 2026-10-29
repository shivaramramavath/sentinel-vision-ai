import { z } from 'zod';

export const MapCameraHealthEventSchema = z.object({
  cameraId: z.string().min(1),
  status: z.enum(['LIVE', 'OFFLINE', 'DEGRADED']),
  fps: z.number().min(0).max(120),
  peopleCount: z.number().int().min(0),
  updatedAt: z.string(), // ISO 8601
  siteId: z.string().optional(),
});
export type MapCameraHealthEvent = z.infer<typeof MapCameraHealthEventSchema>;
export type CameraHealthEvent = MapCameraHealthEvent;

export const MapTrackUpdatedEventSchema = z.object({
  trackId: z.union([z.string(), z.number()]),
  cameraId: z.string().min(1),
  caseId: z.string().optional(),
  siteId: z.string().optional(),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]), // [x1, y1, x2, y2]
  ts: z.string(), // ISO 8601
  coordinates: z.tuple([z.number(), z.number()]).optional(), // [lng, lat]
});
export type MapTrackUpdatedEvent = z.infer<typeof MapTrackUpdatedEventSchema>;
export type TrackUpdatedEvent = MapTrackUpdatedEvent;

export const MapSightingCreatedEventSchema = z.object({
  sightingId: z.string().min(1),
  caseId: z.string().min(1),
  cameraId: z.string().min(1),
  siteId: z.string().optional(),
  coordinates: z.tuple([z.number(), z.number()]), // [lng, lat]
  score: z.number().min(0).max(1),
  ts: z.string(), // ISO 8601
});
export type MapSightingCreatedEvent = z.infer<typeof MapSightingCreatedEventSchema>;

export const JourneyHopSchema = z.object({
  sequence: z.number().int().positive(),
  sightingId: z.string().min(1),
  cameraId: z.string().min(1),
  coordinates: z.tuple([z.number(), z.number()]), // [lng, lat]
  timestamp: z.string(),
  score: z.number().min(0).max(1),
  status: z.string(),
});
export type JourneyHop = z.infer<typeof JourneyHopSchema>;

export const MapJourneyUpdatedEventSchema = z.object({
  caseId: z.string().min(1),
  hops: z.array(JourneyHopSchema),
});
export type MapJourneyUpdatedEvent = z.infer<typeof MapJourneyUpdatedEventSchema>;
export type JourneyUpdatedEvent = MapJourneyUpdatedEvent;
