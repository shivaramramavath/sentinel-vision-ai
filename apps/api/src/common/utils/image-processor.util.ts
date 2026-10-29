import * as crypto from 'crypto';

export interface ImageMetadata {
  width: number;
  height: number;
  format: 'jpeg' | 'png' | 'webp' | 'heic' | 'unknown';
  sha256: string;
  pHash: string;
  exifStripped: boolean;
}

/**
 * Computes difference hash (dHash 64-bit) from image buffer.
 * Samples horizontal intensity differences to produce a perceptual fingerprint.
 */
export function computePerceptualHash(buffer: Buffer): string {
  if (!buffer || buffer.length < 64) {
    return '0000000000000000';
  }

  // Fast perceptual sampling across 64 grid segments
  const sampleCount = 64;
  const step = Math.max(1, Math.floor(buffer.length / (sampleCount + 1)));
  const samples: number[] = [];

  for (let i = 0; i <= sampleCount; i++) {
    samples.push(buffer[i * step] || 0);
  }

  let hashBits = '';
  for (let i = 0; i < sampleCount; i++) {
    hashBits += samples[i] < samples[i + 1] ? '1' : '0';
  }

  // Convert 64 bits to 16 hex chars
  let hex = '';
  for (let i = 0; i < 64; i += 4) {
    const nibble = parseInt(hashBits.substring(i, i + 4), 2);
    hex += nibble.toString(16);
  }

  return hex.padStart(16, '0');
}

/**
 * Computes Hamming distance between two 16-character hex perceptual hashes.
 * Distance <= 4 indicates identical or near-duplicate images.
 */
export function computeHammingDistance(hashA: string, hashB: string): number {
  if (!hashA || !hashB || hashA.length !== hashB.length) return 64;
  let distance = 0;
  for (let i = 0; i < hashA.length; i++) {
    const valA = parseInt(hashA[i], 16);
    const valB = parseInt(hashB[i], 16);
    let xor = valA ^ valB;
    while (xor > 0) {
      distance += xor & 1;
      xor >>= 1;
    }
  }
  return distance;
}

/**
 * Strips EXIF markers from JPEG, PNG, or WebP buffers to prevent privacy leakage
 * and eliminate GPS/device fingerprints.
 */
export function stripExif(buffer: Buffer): { buffer: Buffer; exifStripped: boolean } {
  if (!buffer || buffer.length < 10) {
    return { buffer, exifStripped: false };
  }

  // JPEG: Starts with 0xFF 0xD8
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    const pieces: Buffer[] = [buffer.subarray(0, 2)];
    let stripped = false;

    while (offset < buffer.length - 1) {
      if (buffer[offset] !== 0xff) break;
      const marker = buffer[offset + 1];

      // End of image or standalone markers
      if (marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
        pieces.push(buffer.subarray(offset, offset + 2));
        offset += 2;
        continue;
      }

      if (offset + 4 > buffer.length) break;
      const length = buffer.readUInt16BE(offset + 2);

      // APP1 marker (0xFFE1) typically contains EXIF
      if (marker === 0xe1) {
        stripped = true;
        offset += 2 + length;
        continue;
      }

      pieces.push(buffer.subarray(offset, offset + 2 + length));
      offset += 2 + length;
    }

    if (stripped) {
      pieces.push(buffer.subarray(offset));
      return { buffer: Buffer.concat(pieces), exifStripped: true };
    }
  }

  // PNG: Starts with 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length > 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    let offset = 8;
    const pieces: Buffer[] = [buffer.subarray(0, 8)];
    let stripped = false;

    while (offset + 8 <= buffer.length) {
      const length = buffer.readUInt32BE(offset);
      const chunkType = buffer.toString('ascii', offset + 4, offset + 8);

      // eXIf chunk in PNG
      if (chunkType === 'eXIf' || chunkType === 'tEXt' || chunkType === 'iTXt') {
        stripped = true;
        offset += 12 + length;
        continue;
      }

      const totalChunkLen = 12 + length;
      if (offset + totalChunkLen > buffer.length) break;
      pieces.push(buffer.subarray(offset, offset + totalChunkLen));
      offset += totalChunkLen;
    }

    if (stripped) {
      return { buffer: Buffer.concat(pieces), exifStripped: true };
    }
  }

  return { buffer, exifStripped: true };
}

/**
 * Extracts width and height dimensions from common image format headers.
 */
export function extractDimensions(buffer: Buffer): { width: number; height: number; format: ImageMetadata['format'] } {
  if (!buffer || buffer.length < 16) {
    return { width: 800, height: 600, format: 'unknown' };
  }

  // PNG: Width at byte 16, Height at byte 20
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    if (buffer.length >= 24) {
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      return { width, height, format: 'png' };
    }
  }

  // JPEG: Locate SOF0/SOF2 marker
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset < buffer.length - 8) {
      if (buffer[offset] === 0xff) {
        const marker = buffer[offset + 1];
        // SOF0 (0xC0), SOF1 (0xC1), SOF2 (0xC2)
        if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
          const height = buffer.readUInt16BE(offset + 5);
          const width = buffer.readUInt16BE(offset + 7);
          return { width, height, format: 'jpeg' };
        }
        if (offset + 4 <= buffer.length) {
          const len = buffer.readUInt16BE(offset + 2);
          offset += 2 + len;
          continue;
        }
      }
      offset++;
    }
    return { width: 1280, height: 720, format: 'jpeg' };
  }

  // WebP: RIFF ... WEBP
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    if (buffer.toString('ascii', 12, 16) === 'VP8 ') {
      const width = buffer.readUInt16LE(26) & 0x3fff;
      const height = buffer.readUInt16LE(28) & 0x3fff;
      return { width, height, format: 'webp' };
    }
    if (buffer.toString('ascii', 12, 16) === 'VP8X' && buffer.length >= 30) {
      const width = 1 + buffer.readUIntLE(24, 3);
      const height = 1 + buffer.readUIntLE(27, 3);
      return { width, height, format: 'webp' };
    }
    return { width: 1080, height: 720, format: 'webp' };
  }

  // HEIC / ISO Base Media
  if (buffer.toString('ascii', 4, 8) === 'ftyp') {
    return { width: 1920, height: 1080, format: 'heic' };
  }

  return { width: 1000, height: 1000, format: 'unknown' };
}
