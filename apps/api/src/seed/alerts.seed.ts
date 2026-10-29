import { Model } from 'mongoose';
import { SystemAlertDocument } from '../alerts/schemas/alert.schema';
import { resolveOffset } from './time-offsets';

export async function seedAlerts(
  alertModel: Model<SystemAlertDocument>,
  options: { reset?: boolean } = {},
) {
  if (options.reset) {
    await alertModel.deleteMany({ seed: true });
  }

  const alerts = [
    {
      seedKey: 'al_01',
      id: 'al_01',
      dedupeKey: 'cam_001_detection',
      occurrenceCount: 3,
      type: 'detection',
      severity: 'critical',
      status: 'new',
      title: 'High-Confidence Biometric Match on CAM-001',
      message: 'Candidate matching MP-2026-0891 observed at Metro Central Concourse with 89.2% fused confidence.',
      cameraCode: 'CAM-001',
      caseId: 'MP-2026-0891',
      caseNumber: 'MP-2026-0891',
      personName: 'Maya Lin',
      timestampOffset: '-15m',
      slaExpiresAtOffset: '+15m',
      read: false,
      seed: true,
    },
    {
      seedKey: 'al_02',
      id: 'al_02',
      dedupeKey: 'cam_014_offline',
      occurrenceCount: 1,
      type: 'camera',
      severity: 'warning',
      status: 'new',
      title: 'Camera Feed Disconnected',
      message: 'Camera CAM-014 (Terminal 1 Departures) RTSP stream unresponsive for > 120s.',
      cameraCode: 'CAM-014',
      timestampOffset: '-45m',
      slaExpiresAtOffset: '+45m',
      read: false,
      seed: true,
    },
    {
      seedKey: 'al_03',
      id: 'al_03',
      dedupeKey: 'sla_escalation_case_1042',
      occurrenceCount: 2,
      type: 'case',
      severity: 'warning',
      status: 'acknowledged',
      title: 'SLA Escalation: Review Pending for Minor Case',
      message: 'Candidate sighting on CAM-007 approaching 60-minute review target window without supervisor sign-off.',
      cameraCode: 'CAM-007',
      caseId: 'MP-2026-1042',
      caseNumber: 'MP-2026-1042',
      personName: 'Maya Chen',
      timestampOffset: '-1h',
      slaExpiresAtOffset: '+30m',
      read: true,
      seed: true,
    },
  ];

  const seededAlerts = [];

  for (const a of alerts) {
    const doc = {
      ...a,
      timestamp: resolveOffset(a.timestampOffset),
      slaExpiresAt: resolveOffset(a.slaExpiresAtOffset),
    };

    const saved = await alertModel.findOneAndUpdate(
      { id: a.id },
      { $set: doc },
      { upsert: true, new: true },
    );
    seededAlerts.push(saved);
  }

  return { count: seededAlerts.length, alerts: seededAlerts };
}
