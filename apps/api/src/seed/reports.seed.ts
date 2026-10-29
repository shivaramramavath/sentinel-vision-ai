import { Model } from 'mongoose';
import { SystemReportDocument } from '../reports/schemas/report.schema';
import { CaseDocument } from '../cases/schemas/case.schema';
import { resolveOffset } from './time-offsets';

export async function seedReports(
  reportModel: Model<SystemReportDocument>,
  caseModel: Model<CaseDocument>,
  options: { reset?: boolean } = {},
) {
  if (options.reset) {
    await reportModel.deleteMany({ seed: true });
  }

  const case1 = await caseModel.findOne({ caseNumber: 'MP-2026-0891' });
  const case2 = await caseModel.findOne({ caseNumber: 'MP-2026-1042' });

  const reports = [
    {
      seedKey: 'rep_001',
      id: 'rep_001',
      caseId: case1 ? case1._id.toString() : 'case_001',
      title: 'Court-Ready Evidentiary Dossier: Maya Lin',
      type: 'investigation_summary',
      generatedBy: 'Insp. Sarah Vance',
      generatedAtOffset: '-1h',
      format: 'PDF',
      fileSize: '4.2 MB',
      downloadUrl: '/api/v1/reports/rep_001/download',
      seed: true,
    },
    {
      seedKey: 'rep_002',
      id: 'rep_002',
      caseId: case2 ? case2._id.toString() : 'case_002',
      title: 'Movement Trajectory & Chronology Export: Maya Chen',
      type: 'movement_timeline',
      generatedBy: 'Insp. Sarah Vance',
      generatedAtOffset: '-2h',
      format: 'CSV',
      fileSize: '380 KB',
      downloadUrl: '/api/v1/reports/rep_002/download',
      seed: true,
    },
  ];

  const seededReports = [];

  for (const r of reports) {
    const doc = {
      ...r,
      generatedAt: resolveOffset(r.generatedAtOffset),
    };

    const saved = await reportModel.findOneAndUpdate(
      { id: r.id },
      { $set: doc },
      { upsert: true, new: true },
    );
    seededReports.push(saved);
  }

  return { count: seededReports.length, reports: seededReports };
}
