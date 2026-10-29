import { computeReadinessScore, DEFAULT_READINESS_WEIGHTS } from './readiness-calculator.util';
import { ReferenceImage } from '../references/schemas/reference-image.schema';

describe('Readiness Score Algorithm', () => {
  const baseFaceFront: any = {
    referenceId: 'ref_face_01',
    type: 'face_front',
    photoTakenAt: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(), // 1 month ago
    analysis: {
      status: 'ready',
      face: { detected: true, quality: 0.95, blur: 0.05, usable: true },
      poseBin: 'front',
    },
    consistencyScore: 0.96,
  };

  const baseFaceAngles: any = [
    {
      referenceId: 'ref_face_left',
      type: 'face_left',
      analysis: { face: { detected: true, quality: 0.9, usable: true }, poseBin: 'left' },
      consistencyScore: 0.95,
    },
    {
      referenceId: 'ref_face_right',
      type: 'face_right',
      analysis: { face: { detected: true, quality: 0.88, usable: true }, poseBin: 'right' },
      consistencyScore: 0.94,
    },
    {
      referenceId: 'ref_face_prof',
      type: 'face_profile',
      analysis: { face: { detected: true, quality: 0.87, usable: true }, poseBin: 'left' },
      consistencyScore: 0.93,
    },
  ];

  const baseBody: any = [
    {
      referenceId: 'ref_body_front',
      type: 'full_body_front',
      analysis: {
        body: { detected: true, completeness: 0.95, resolution: { height: 1080 }, usable: true },
        poseBin: 'front',
      },
    },
    {
      referenceId: 'ref_body_back',
      type: 'full_body_back',
      analysis: {
        body: { detected: true, completeness: 0.9, resolution: { height: 1080 }, usable: true },
        poseBin: 'back',
      },
    },
    {
      referenceId: 'ref_body_side',
      type: 'full_body_side',
      analysis: {
        body: { detected: true, completeness: 0.9, resolution: { height: 1080 }, usable: true },
        poseBin: 'left',
      },
    },
  ];

  const baseClothingPhoto: any = {
    referenceId: 'ref_cloth',
    type: 'last_seen_clothing',
    analysis: { status: 'ready' },
  };

  it('should compute high readiness score (~90-100) when full biometric reference coverage is present', () => {
    const refs = [baseFaceFront, ...baseFaceAngles, ...baseBody, baseClothingPhoto];
    const evaluation = computeReadinessScore(refs, null);

    expect(evaluation.readinessScore).toBeGreaterThanOrEqual(85);
    expect(evaluation.breakdown.c_face_front).toBeGreaterThanOrEqual(0.9);
    expect(evaluation.breakdown.c_face_angles).toBe(1.0);
    expect(evaluation.breakdown.c_body).toBeGreaterThanOrEqual(0.9);
    expect(evaluation.breakdown.c_body_views).toBe(1.0);
    expect(evaluation.breakdown.c_clothing).toBe(1.0);
  });

  it('should penalize readiness and generate specific recommendations when frontal face or body photos are missing', () => {
    const refs: any[] = [
      {
        referenceId: 'ref_side_only',
        type: 'face_left',
        analysis: { face: { detected: true, quality: 0.8, usable: true }, poseBin: 'left' },
      },
    ];

    const evaluation = computeReadinessScore(refs, null);

    expect(evaluation.readinessScore).toBeLessThan(40);
    expect(evaluation.breakdown.c_face_front).toBe(0);
    expect(evaluation.recommendations).toContain(
      'Add a clear, unoccluded frontal face reference photograph.',
    );
    expect(evaluation.recommendations).toContain(
      'Add full-body standing photographs showing head-to-toe proportions.',
    );
  });

  it('should apply recency decay when photos are older than 2 years', () => {
    const oldDate = new Date(Date.now() - 3 * 365.25 * 24 * 3600 * 1000).toISOString(); // 3 years old
    const oldPhoto: any = {
      ...baseFaceFront,
      photoTakenAt: oldDate,
    };

    const evaluation = computeReadinessScore([oldPhoto], null);

    expect(evaluation.breakdown.c_recency).toBeLessThan(0.6);
    expect(
      evaluation.recommendations.some((r) => r.includes('years old')),
    ).toBe(true);
  });
});
