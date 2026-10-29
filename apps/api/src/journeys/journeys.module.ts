import { Module } from '@nestjs/common';
import { JourneysService } from './journeys.service';
import { JourneysController } from './journeys.controller';
import { SightingsModule } from '../sightings/sightings.module';
import { CamerasModule } from '../cameras/cameras.module';

@Module({
  imports: [SightingsModule, CamerasModule],
  controllers: [JourneysController],
  providers: [JourneysService],
  exports: [JourneysService],
})
export class JourneysModule {}
