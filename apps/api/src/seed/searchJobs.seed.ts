import { Model } from 'mongoose';
import { SearchJobDocument } from '../search-jobs/schemas/search-job.schema';
import { CaseDocument } from '../cases/schemas/case.schema';
import { resolveOffset } from './time-offsets';

export async function seedSearchJobs(
  searchJobModel: Model<SearchJobDocument>,
  caseModel: Model<CaseDocument>,
  options: { reset?: boolean } = {},
) {
  if (options.reset) {
    await searchJobModel.deleteMany({ seed: true });
  }

  const case1 = await caseModel.findOne({ caseNumber: 'MP-2026-0891' });
  const case2 = await caseModel.findOne({ caseNumber: 'MP-2026-1042' });

  const jobs = [
    {
      seedKey: 'job_001',
      id: 'job_001',
      caseId: case1 ? case1._id.toString() : 'case_001',
      caseTitle: case1 ? case1.title : 'Disappearance of Maya Lin (Age 14)',
      referencePhotoUrl: case1?.referencePhotos[0]?.url || '/uploads/reference-photos/ref_maya_lin_front.svg',
      status: 'running',
      progressPercent: 78,
      candidatesFound: 5,
      cameraScopeCount: 124,
      timeRangeHours: 24,
      minConfidence: 0.75,
      startedAtOffset: '-1h30m',
      seed: true,
    },
    {
      seedKey: 'job_002',
      id: 'job_002',
      caseId: case2 ? case2._id.toString() : 'case_002',
      caseTitle: case2 ? case2.title : 'Disappearance of Maya Chen (Age 14)',
      referencePhotoUrl: case2?.referencePhotos[0]?.url || '/uploads/reference-photos/ref_maya_chen_front.svg',
      status: 'completed',
      progressPercent: 100,
      candidatesFound: 4,
      cameraScopeCount: 124,
      timeRangeHours: 48,
      minConfidence: 0.70,
      startedAtOffset: '-3h',
      completedAtOffset: '-2h',
      seed: true,
    },
  ];

  const seededJobs = [];

  for (const j of jobs) {
    const doc = {
      ...j,
      startedAt: resolveOffset(j.startedAtOffset),
      completedAt: j.completedAtOffset ? resolveOffset(j.completedAtOffset) : null,
    };

    const saved = await searchJobModel.findOneAndUpdate(
      { id: j.id },
      { $set: doc },
      { upsert: true, new: true },
    );
    seededJobs.push(saved);
  }

  return { count: seededJobs.length, jobs: seededJobs };
}
