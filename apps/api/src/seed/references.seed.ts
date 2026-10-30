import { Model } from 'mongoose';
import { CaseDocument } from '../cases/schemas/case.schema';
import { MediaAssetDocument } from '../common/storage/schemas/media-asset.schema';

/**
 * Deterministically generates a normalized 512-dimensional synthetic vector for testing/dev.
 */
export function generateSyntheticEmbedding(seed: string): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }

  const vec: number[] = [];
  let sumSq = 0;
  for (let i = 0; i < 512; i++) {
    h = (Math.imul(1664525, h) + 1013904223) | 0;
    const val = (h / 2147483648);
    vec.push(val);
    sumSq += val * val;
  }

  const norm = Math.sqrt(sumSq) || 1;
  return vec.map((v) => v / norm);
}

export async function seedReferences(
  caseModel: Model<CaseDocument>,
  mediaAssetModel?: Model<MediaAssetDocument>,
  options: { reset?: boolean } = {},
) {
  const driver = (process.env.STORAGE_DRIVER || 'cloudinary') as 'cloudinary' | 'minio';
  const rootFolder = process.env.CLOUDINARY_ROOT_FOLDER || 'sentinel/dev';
  const cases = await caseModel.find({ seed: true });
  let totalRefs = 0;

  for (const c of cases) {
    if (c.referencePhotos && c.referencePhotos.length > 0) {
      for (const ref of c.referencePhotos) {
        totalRefs++;
        if (mediaAssetModel) {
          const publicId = `${rootFolder}/cases/${c._id || c.id}/references/${ref.id}`;
          const sha256 = ref.provenance?.fileHashSha256 || '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08';
          await mediaAssetModel.findOneAndUpdate(
            { publicId },
            {
              $set: {
                assetId: `ast_${ref.id}`,
                provider: driver,
                publicId,
                version: 1,
                format: 'svg',
                bytes: 4096,
                sha256,
                width: 400,
                height: 400,
                deliveryType: 'authenticated',
                secureUrl: ref.url,
                context: {
                  caseId: String(c._id || c.id),
                  referenceId: ref.id,
                  type: ref.type,
                  kind: 'reference',
                },
                tags: ['reference', String(c._id || c.id), ref.type],
                legalHold: false,
                uploadedBy: ref.provenance?.verifiedBy || 'system',
                status: 'active',
              },
            },
            { upsert: true, new: true },
          );
        }
      }
    }
  }

  return { count: totalRefs };
}
