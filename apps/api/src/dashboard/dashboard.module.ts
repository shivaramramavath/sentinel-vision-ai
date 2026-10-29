import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Case, CaseSchema } from '../cases/schemas/case.schema';
import { Sighting, SightingSchema } from '../sightings/schemas/sighting.schema';
import { Camera, CameraSchema } from '../cameras/schemas/camera.schema';
import { SearchJob, SearchJobSchema } from '../search-jobs/schemas/search-job.schema';
import { User, UserSchema } from '../users/schemas/user.schema';

import { SystemAlert, SystemAlertSchema } from '../alerts/schemas/alert.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Case.name, schema: CaseSchema },
      { name: Sighting.name, schema: SightingSchema },
      { name: Camera.name, schema: CameraSchema },
      { name: SearchJob.name, schema: SearchJobSchema },
      { name: User.name, schema: UserSchema },
      { name: SystemAlert.name, schema: SystemAlertSchema },
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
