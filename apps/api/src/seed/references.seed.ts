import { Model } from 'mongoose';
import { CaseDocument } from '../cases/schemas/case.schema';

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
  options: { reset?: boolean } = {},
) {
  const cases = await caseModel.find({ seed: true });
  let totalRefs = 0;

  for (const c of cases) {
    if (c.referencePhotos && c.referencePhotos.length > 0) {
      totalRefs += c.referencePhotos.length;
    }
  }

  return { count: totalRefs };
}
