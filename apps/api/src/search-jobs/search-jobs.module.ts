import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SearchJob, SearchJobSchema } from './schemas/search-job.schema';
import { SearchJobsService } from './search-jobs.service';
import { SearchJobsController } from './search-jobs.controller';
import { SearchPlanningService } from './services/search-planning.service';
import { JobProgressService } from './services/job-progress.service';
import { JobEventConsumerService } from './services/job-event-consumer.service';
import { CasesModule } from '../cases/cases.module';
import { SightingsModule } from '../sightings/sightings.module';
import { EvidenceModule } from '../evidence/evidence.module';
import { CamerasModule } from '../cameras/cameras.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SearchJob.name, schema: SearchJobSchema },
    ]),
    CasesModule,
    SightingsModule,
    EvidenceModule,
    CamerasModule,
  ],
  controllers: [SearchJobsController],
  providers: [
    SearchJobsService,
    SearchPlanningService,
    JobProgressService,
    JobEventConsumerService,
  ],
  exports: [
    SearchJobsService,
    SearchPlanningService,
    JobProgressService,
    JobEventConsumerService,
    MongooseModule,
  ],
})
export class SearchJobsModule {}
