import { z } from 'zod';

export const MediaAssetKindSchema = z.enum([
  'reference',
  'crop',
  'frame',
  'clip',
  'report',
  'avatar',
  'export',
]);
export type MediaAssetKind = z.infer<typeof MediaAssetKindSchema>;

export const MediaAssetSchema = z.object({
  id: z.string(),
  provider: z.enum(['cloudinary', 'minio', 'local']),
  publicId: z.string(),
  resourceType: z.enum(['image', 'video', 'raw']),
  deliveryType: z.enum(['authenticated', 'private', 'upload']),
  version: z.number().optional(),
  format: z.string(),
  bytes: z.number(),
  width: z.number().optional(),
  height: z.number().optional(),
  durationSec: z.number().optional(),
  sha256: z.string(),
  etag: z.string().optional(),
  folder: z.string(),
  tags: z.array(z.string()).default([]),
  context: z
    .object({
      caseId: z.string().optional(),
      cameraId: z.string().optional(),
      capturedAt: z.string().optional(),
    })
    .optional(),
  status: z.enum(['pending', 'ready', 'failed', 'deleted']).default('ready'),
  uploadedBy: z.string().optional(),
  uploadedAt: z.coerce.date(),
  legalHold: z.boolean().default(false),
  deletedAt: z.coerce.date().optional(),
});
export type MediaAsset = z.infer<typeof MediaAssetSchema>;

export const ProviderUsageSchema = z.object({
  provider: z.string(),
  plan: z.string().optional(),
  credits: z
    .object({
      used: z.number().optional(),
      limit: z.number().optional(),
      usedPercent: z.number().optional(),
    })
    .optional(),
  storage: z.object({
    usedBytes: z.number(),
    limitBytes: z.number().optional(),
  }),
  bandwidth: z
    .object({
      usedBytes: z.number().optional(),
      limitBytes: z.number().optional(),
    })
    .optional(),
  objectsCount: z.number().optional(),
});
export type ProviderUsage = z.infer<typeof ProviderUsageSchema>;

export const SignedUrlOptionsSchema = z.object({
  purpose: z.enum(['view', 'download', 'inference', 'thumbnail']).default('view'),
  ttlSeconds: z.number().optional(),
  transform: z.string().optional(),
});
export type SignedUrlOptions = z.infer<typeof SignedUrlOptionsSchema>;
