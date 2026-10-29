import { ReferenceImage } from '../references/schemas/reference-image.schema';
import { MissingPerson } from '../missing-persons/schemas/missing-person.schema';
import { ReadinessBreakdown, ReadinessWeights } from './schemas/reference-set.schema';

export interface ReadinessEvaluation {
  readinessScore: number; // 0-100
  breakdown: ReadinessBreakdown;
  weights: ReadinessWeights;
  recommendations: string[];
}

export const DEFAULT_READINESS_WEIGHTS: ReadinessWeights = {
  w_face_front: 0.2,
  w_face_angles: 0.2,
  w_body: 0.2,
  w_body_views: 0.1,
  w_clothing: 0.15,
  w_recency: 0.1,
  w_consistency: 0.05,
};

export function computeReadinessScore(
  references: ReferenceImage[],
  missingPerson?: Partial<MissingPerson> | null,
  customWeights?: Partial<ReadinessWeights>,
): ReadinessEvaluation {
  const weights: ReadinessWeights = {
    ...DEFAULT_READINESS_WEIGHTS,
    ...customWeights,
  };

  const activeRefs = references.filter((r) => !r.deletedAt);
  const recommendations: string[] = [];

  // 1. c_face_front (w 0.20): best usable frontal face quality (0-1)
  const frontalFaces = activeRefs.filter(
    (r) =>
      (r.type === 'face_front' || r.analysis?.poseBin === 'front') &&
      r.analysis?.face?.usable !== false &&
      r.analysis?.face?.detected,
  );
  let c_face_front = 0;
  if (frontalFaces.length > 0) {
    c_face_front = Math.max(
      ...frontalFaces.map((r) => Math.min(1, r.analysis?.face?.quality ?? 0.85)),
    );
  } else {
    recommendations.push('Add a clear, unoccluded frontal face reference photograph.');
  }

  // 2. c_face_angles (w 0.20): coverage of left/right/profile bins (usable faces / 3 target angles)
  const angleBins = new Set<string>();
  activeRefs.forEach((r) => {
    if (r.analysis?.face?.usable !== false && r.analysis?.face?.detected) {
      if (['face_left', 'face_right', 'face_profile'].includes(r.type)) {
        angleBins.add(r.type);
      } else if (r.analysis?.poseBin && ['left', 'right', 'front_left', 'front_right'].includes(r.analysis.poseBin)) {
        angleBins.add(r.analysis.poseBin);
      }
    }
  });
  const c_face_angles = Math.min(1, angleBins.size / 3);
  if (c_face_angles < 0.67) {
    recommendations.push('Add left-profile or three-quarter angle facial references to improve Re-ID matching.');
  }

  // 3. c_body (w 0.20): best full-body completeness * resolution factor
  const bodyRefs = activeRefs.filter(
    (r) =>
      ['full_body_front', 'full_body_back', 'full_body_side'].includes(r.type) &&
      r.analysis?.body?.usable !== false &&
      r.analysis?.body?.detected,
  );
  let c_body = 0;
  if (bodyRefs.length > 0) {
    c_body = Math.max(
      ...bodyRefs.map((r) => {
        const comp = r.analysis?.body?.completeness ?? 0.8;
        const res = r.analysis?.body?.resolution?.height ?? 1080;
        const resFactor = Math.min(1, res / 1080);
        return Math.min(1, comp * resFactor);
      }),
    );
  } else {
    recommendations.push('Add full-body standing photographs showing head-to-toe proportions.');
  }

  // 4. c_body_views (w 0.10): front + back + side coverage
  const bodyViews = new Set<string>();
  bodyRefs.forEach((r) => {
    if (r.type === 'full_body_front' || r.analysis?.poseBin === 'front') bodyViews.add('front');
    if (r.type === 'full_body_back' || r.analysis?.poseBin === 'back') bodyViews.add('back');
    if (r.type === 'full_body_side' || ['left', 'right'].includes(r.analysis?.poseBin || ''))
      bodyViews.add('side');
  });
  const c_body_views = Math.min(1, bodyViews.size / 3);
  if (c_body_views < 0.67) {
    recommendations.push('Add back and side full-body views for multi-camera gait and posture recognition.');
  }

  // 5. c_clothing (w 0.15): last-seen clothing photo or detailed clothing description
  const clothingPhotos = activeRefs.filter((r) => r.type === 'last_seen_clothing');
  let c_clothing = 0;
  if (clothingPhotos.length > 0) {
    c_clothing = 1.0;
  } else if (
    missingPerson?.lastSeenClothing?.items &&
    missingPerson.lastSeenClothing.items.length >= 2
  ) {
    c_clothing = 0.85;
  } else if (
    missingPerson?.lastSeenClothing?.items &&
    missingPerson.lastSeenClothing.items.length === 1
  ) {
    c_clothing = 0.5;
  } else {
    recommendations.push('Enroll a photograph or detailed color description of the clothing worn when last seen.');
  }

  // 6. c_recency (w 0.10): newest photo age (decay with years since photoTakenAt)
  let c_recency = 0.8; // default baseline
  const datedRefs = activeRefs.filter((r) => r.photoTakenAt);
  if (datedRefs.length > 0) {
    const newestDate = Math.max(...datedRefs.map((r) => new Date(r.photoTakenAt!).getTime()));
    const yearsElapsed = Math.max(0, (Date.now() - newestDate) / (1000 * 3600 * 24 * 365.25));
    c_recency = Math.exp(-0.2 * yearsElapsed);
    if (yearsElapsed > 2) {
      recommendations.push(`Enrolled photographs are over ${Math.floor(yearsElapsed)} years old. Provide current pictures if available.`);
    }
  }

  // 7. c_consistency (w 0.05): mean pairwise face similarity within the set
  const faceRefs = activeRefs.filter((r) => r.analysis?.face?.detected);
  let c_consistency = 0.95;
  if (faceRefs.length >= 2) {
    const scores = faceRefs
      .map((r) => r.consistencyScore ?? 0.92)
      .filter((s) => typeof s === 'number');
    c_consistency = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    if (c_consistency < 0.75) {
      recommendations.push('One or more reference photos exhibit low biometric consistency with the set. Review for possible misidentification.');
    }
  }

  // Any blur warning in active refs
  const blurryRefs = activeRefs.filter((r) => (r.analysis?.face?.blur ?? 0) > 0.6);
  if (blurryRefs.length > 0) {
    recommendations.push(`Reference photo ${blurryRefs[0].referenceId} has noticeable blur. Consider re-uploading a sharper version.`);
  }

  // Calculate weighted readiness score
  const weightedSum =
    c_face_front * weights.w_face_front +
    c_face_angles * weights.w_face_angles +
    c_body * weights.w_body +
    c_body_views * weights.w_body_views +
    c_clothing * weights.w_clothing +
    c_recency * weights.w_recency +
    c_consistency * weights.w_consistency;

  const readinessScore = Math.min(100, Math.max(0, Math.round(weightedSum * 100)));

  const breakdown: ReadinessBreakdown = {
    c_face_front: Number(c_face_front.toFixed(3)),
    c_face_angles: Number(c_face_angles.toFixed(3)),
    c_body: Number(c_body.toFixed(3)),
    c_body_views: Number(c_body_views.toFixed(3)),
    c_clothing: Number(c_clothing.toFixed(3)),
    c_recency: Number(c_recency.toFixed(3)),
    c_consistency: Number(c_consistency.toFixed(3)),
  };

  return {
    readinessScore,
    breakdown,
    weights,
    recommendations,
  };
}
