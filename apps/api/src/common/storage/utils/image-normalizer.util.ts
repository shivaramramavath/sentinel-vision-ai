import sharp from 'sharp';
import { createHash } from 'crypto';
import { BadRequestException } from '@nestjs/common';
import { MediaAssetKind } from '@sentinel/shared-types';

export interface NormalizedMedia {
  buffer: Buffer;
  mimeType: string;
  format: string;
  width?: number;
  height?: number;
  sha256: string;
  bytes: number;
}

const ALLOWED_IMAGE_MIMES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/bmp',
  'image/tiff',
];

const ALLOWED_VIDEO_MIMES = ['video/mp4', 'video/quicktime'];
const ALLOWED_REPORT_MIMES = ['application/pdf'];
const ALLOWED_EXPORT_MIMES = ['application/zip', 'application/x-zip-compressed'];

export function validateMimeType(kind: MediaAssetKind, mimeType: string): void {
  const normalizedMime = mimeType.toLowerCase().trim();

  switch (kind) {
    case 'reference':
    case 'crop':
    case 'frame':
    case 'avatar':
      if (!ALLOWED_IMAGE_MIMES.includes(normalizedMime)) {
        throw new BadRequestException(
          `Invalid MIME type '${mimeType}' for ${kind}. Allowed formats: JPG, PNG, WebP, HEIC`,
        );
      }
      break;
    case 'clip':
      if (!ALLOWED_VIDEO_MIMES.includes(normalizedMime)) {
        throw new BadRequestException(
          `Invalid video MIME type '${mimeType}'. Allowed format: MP4`,
        );
      }
      break;
    case 'report':
      if (!ALLOWED_REPORT_MIMES.includes(normalizedMime)) {
        throw new BadRequestException(
          `Invalid report MIME type '${mimeType}'. Allowed format: PDF`,
        );
      }
      break;
    case 'export':
      if (!ALLOWED_EXPORT_MIMES.includes(normalizedMime)) {
        throw new BadRequestException(
          `Invalid export archive MIME type '${mimeType}'. Allowed format: ZIP`,
        );
      }
      break;
  }
}

export async function normalizeImage(
  inputBuffer: Buffer,
  declaredMimeType: string,
): Promise<NormalizedMedia> {
  try {
    const pipeline = sharp(inputBuffer)
      .rotate(); // auto-orient based on EXIF orientation tag (sharp strips EXIF metadata on output by default)

    const metadata = await pipeline.metadata();

    // Check dimensions and cap longest side at 4096 px
    const maxDimension = 4096;
    if (
      (metadata.width && metadata.width > maxDimension) ||
      (metadata.height && metadata.height > maxDimension)
    ) {
      pipeline.resize({
        width: maxDimension,
        height: maxDimension,
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    // Convert HEIC, TIFF, BMP to standard JPEG
    const isSpecialFormat = ['heic', 'heif', 'tiff', 'bmp'].includes(metadata.format || '');
    if (isSpecialFormat) {
      pipeline.jpeg({ quality: 92 });
    }

    const { data: outputBuffer, info } = await pipeline.toBuffer({ resolveWithObject: true });

    const sha256 = createHash('sha256').update(outputBuffer).digest('hex');

    let outputMime = declaredMimeType;
    if (info.format === 'jpeg') outputMime = 'image/jpeg';
    else if (info.format === 'png') outputMime = 'image/png';
    else if (info.format === 'webp') outputMime = 'image/webp';

    return {
      buffer: outputBuffer,
      mimeType: outputMime,
      format: info.format,
      width: info.width,
      height: info.height,
      sha256,
      bytes: outputBuffer.length,
    };
  } catch (err: any) {
    throw new BadRequestException(
      `Failed to process and normalize image asset: ${err.message || 'corrupt image buffer'}`,
    );
  }
}

export function computeSha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}
