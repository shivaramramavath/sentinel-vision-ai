export const AI_MODEL_REGISTRY = {
  face: {
    name: 'ArcFace',
    version: 'v2.1',
    embeddingDim: 512,
    metric: 'Cosine Similarity',
    threshold: 0.65,
    description: 'Deep face recognition embedding with 5-landmark alignment',
  },
  reid: {
    name: 'OSNet-AIN',
    version: 'x1.0',
    embeddingDim: 512,
    metric: 'Euclidean / Cosine',
    threshold: 0.58,
    description: 'Omni-Scale Network with attention for whole-body person Re-ID',
  },
  color: {
    name: 'HSV Color Histogram',
    version: 'v2.0',
    embeddingDim: 32,
    metric: 'Bhattacharyya Distance',
    threshold: 0.50,
    description: 'Spatial 3-tier color distribution across upper/lower clothing',
  },
  spatiotemporal: {
    name: 'Kinematic Plausibility',
    version: 'v1.4',
    algorithm: 'Kalman Velocity Gate',
    walkingSpeedRangeMps: [0.8, 1.8],
    description: 'Physical transit speed and topology graph traversal plausibility',
  },
} as const;

export function isMinorFromDob(dob?: string): boolean {
  if (!dob) return false;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return false;
  const ageDifMs = Date.now() - birth.getTime();
  const ageDate = new Date(ageDifMs);
  return Math.abs(ageDate.getUTCFullYear() - 1970) < 18;
}
