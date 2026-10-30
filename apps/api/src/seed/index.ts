import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Camera, CameraDocument } from '../cameras/schemas/camera.schema';
import { CameraTopology, CameraTopologyDocument } from '../cameras/schemas/camera-topology.schema';
import { Case, CaseDocument } from '../cases/schemas/case.schema';
import { Sighting, SightingDocument } from '../sightings/schemas/sighting.schema';
import { Evidence, EvidenceDocument } from '../evidence/schemas/evidence.schema';
import { SystemReport, SystemReportDocument } from '../reports/schemas/report.schema';
import { SystemAlert, SystemAlertDocument } from '../alerts/schemas/alert.schema';
import { SearchJob, SearchJobDocument } from '../search-jobs/schemas/search-job.schema';
import { MobileUser, MobileUserDocument } from '../mobile/schemas/mobile-user.schema';
import { MobileDevice, MobileDeviceDocument } from '../mobile/schemas/mobile-device.schema';
import { MediaAsset, MediaAssetDocument } from '../common/storage/schemas/media-asset.schema';

import { ensureSeedAssets } from './seed-assets';
import { seedUsers } from './users.seed';
import { generateAccountsDoc } from './generate-accounts-doc';
import { seedCameras } from './cameras.seed';
import { seedTopology } from './topology.seed';
import { seedCases } from './cases.seed';
import { seedReferences } from './references.seed';
import { seedSightings } from './sightings.seed';
import { seedEvidence } from './evidence.seed';
import { seedSearchJobs } from './searchJobs.seed';
import { seedAlerts } from './alerts.seed';
import { seedReports } from './reports.seed';

async function run() {
  const args = process.argv.slice(2);
  const isReset = args.includes('--reset');
  const isCheck = args.includes('--check');
  const isRefreshTimes = args.includes('--refresh-times');
  const isAccounts = args.includes('--accounts');
  const isForce = args.includes('--force');

  if (process.env.NODE_ENV === 'production' && !isForce) {
    console.error('❌ SEED ABORTED: Cannot run seed in production environment without --force.');
    process.exit(1);
  }

  console.log('🌱 Starting Sentinel Vision AI Database Seeder...');
  if (isReset) console.log('🔄 Mode: RESET (Purging all seed=true records)');
  if (isCheck) console.log('🔍 Mode: CHECK (Verifying referential integrity)');
  if (isRefreshTimes) console.log('⏱️ Mode: REFRESH-TIMES (Updating timestamps)');
  if (isAccounts) console.log('📋 Mode: ACCOUNTS (Seeding deterministic test accounts & updating documentation)');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });

  const userModel = app.get<Model<UserDocument>>(getModelToken(User.name));
  const mobileUserModel = app.get<Model<MobileUserDocument>>(getModelToken(MobileUser.name));
  const mobileDeviceModel = app.get<Model<MobileDeviceDocument>>(getModelToken(MobileDevice.name));
  const cameraModel = app.get<Model<CameraDocument>>(getModelToken(Camera.name));
  const topologyModel = app.get<Model<CameraTopologyDocument>>(getModelToken(CameraTopology.name));
  const caseModel = app.get<Model<CaseDocument>>(getModelToken(Case.name));
  const sightingModel = app.get<Model<SightingDocument>>(getModelToken(Sighting.name));
  const evidenceModel = app.get<Model<EvidenceDocument>>(getModelToken(Evidence.name));
  const reportModel = app.get<Model<SystemReportDocument>>(getModelToken(SystemReport.name));
  const alertModel = app.get<Model<SystemAlertDocument>>(getModelToken(SystemAlert.name));
  const searchJobModel = app.get<Model<SearchJobDocument>>(getModelToken(SearchJob.name));
  const mediaAssetModel = app.get<Model<MediaAssetDocument>>(getModelToken(MediaAsset.name));

  if (isAccounts) {
    console.log('👤 Seeding Deterministic Test Role Accounts...');
    const usersResult = await seedUsers(userModel, mobileUserModel, mobileDeviceModel, { reset: isReset });
    console.log(`✅ Seeded ${usersResult.count} accounts.`);
    generateAccountsDoc();
    await app.close();
    return;
  }

  if (isCheck) {
    console.log('🔎 Running Referential Integrity Audit...');
    const camerasCount = await cameraModel.countDocuments();
    const casesCount = await caseModel.countDocuments();
    const sightingsCount = await sightingModel.countDocuments();
    const usersCount = await userModel.countDocuments();
    const evidenceCount = await evidenceModel.countDocuments();

    console.log(`- Cameras: ${camerasCount} (expected 124)`);
    console.log(`- Cases: ${casesCount} (expected >= 5)`);
    console.log(`- Sightings: ${sightingsCount} (expected >= 7)`);
    console.log(`- Users: ${usersCount} (expected >= 7)`);
    console.log(`- Evidence items: ${evidenceCount}`);

    let errors = 0;
    if (camerasCount < 124) {
      console.error(`❌ Integrity Error: Missing cameras (${camerasCount}/124)`);
      errors++;
    }
    if (casesCount < 5) {
      console.error(`❌ Integrity Error: Missing cases (${casesCount} < 5)`);
      errors++;
    }

    // Verify sightings refer to real cameras and cases
    const sightings = await sightingModel.find();
    for (const s of sightings) {
      const existsCase = await caseModel.findById(s.caseId);
      if (!existsCase) {
        console.error(`❌ Sighting ${s.id} references non-existent caseId ${s.caseId}`);
        errors++;
      }
      const existsCam = await cameraModel.findOne({ $or: [{ id: s.cameraId }, { cameraCode: s.cameraId }] });
      if (!existsCam) {
        console.error(`❌ Sighting ${s.id} references non-existent cameraId ${s.cameraId}`);
        errors++;
      }
    }

    if (errors > 0) {
      console.error(`❌ Integrity Check Failed with ${errors} error(s).`);
      await app.close();
      process.exit(1);
    } else {
      console.log('✅ Referential Integrity Check PASSED! Zero anomalies detected.');
      await app.close();
      return;
    }
  }

  // 1. Seed Assets (offline, non-hotlinked)
  console.log('🖼️ Ensuring local seed assets in apps/api/seed-assets...');
  ensureSeedAssets();

  // 2. Users & Mobile Operators
  console.log('👤 Seeding Users & Roles...');
  const usersResult = await seedUsers(userModel, mobileUserModel, mobileDeviceModel, { reset: isReset });

  // 3. Cameras
  console.log('📹 Seeding 124 Cameras across 8 Sites...');
  const camerasResult = await seedCameras(cameraModel, { reset: isReset });

  // 4. Topology
  console.log('🕸️ Seeding Topology adjacency graph...');
  const topologyResult = await seedTopology(topologyModel, { reset: isReset });

  // 5. Cases
  console.log('📁 Seeding Missing Person Cases...');
  const casesResult = await seedCases(caseModel, { reset: isReset });

  // 6. References
  console.log('📸 Validating Reference Photos...');
  await seedReferences(caseModel, mediaAssetModel, { reset: isReset });

  // 7. Sightings
  console.log('🎯 Seeding Candidate Sightings...');
  const sightingsResult = await seedSightings(sightingModel, caseModel, cameraModel, { reset: isReset });

  // 8. Evidence Vault
  console.log('🔒 Seeding Evidence items & Hash Chains...');
  const evidenceResult = await seedEvidence(evidenceModel, sightingModel, mediaAssetModel, { reset: isReset });

  // 9. Search Jobs
  console.log('⚡ Seeding Search Jobs...');
  const searchResult = await seedSearchJobs(searchJobModel, caseModel, { reset: isReset });

  // 10. Alerts
  console.log('🚨 Seeding Alerts & Deduplication...');
  const alertsResult = await seedAlerts(alertModel, { reset: isReset });

  // 11. Reports
  console.log('📊 Seeding System Reports...');
  const reportsResult = await seedReports(reportModel, caseModel, { reset: isReset });

  console.log('====================================================');
  console.log('✅ Sentinel Vision AI Database Successfully Seeded!');
  console.log(`- Users: ${usersResult.count}`);
  console.log(`- Cameras: ${camerasResult.count}`);
  console.log(`- Topology Transitions: ${topologyResult.count}`);
  console.log(`- Cases: ${casesResult.count}`);
  console.log(`- Sightings: ${sightingsResult.count}`);
  console.log(`- Evidence: ${evidenceResult.count}`);
  console.log(`- Search Jobs: ${searchResult.count}`);
  console.log(`- Alerts: ${alertsResult.count}`);
  console.log(`- Reports: ${reportsResult.count}`);
  console.log('----------------------------------------------------');
  console.log('🔑 Seeded Login Emails:');
  usersResult.seededEmails.forEach((email) => console.log(`   - ${email}`));
  console.log('====================================================');

  await app.close();
}

run().catch((err) => {
  console.error('❌ Seeder execution failed:', err);
  process.exit(1);
});
