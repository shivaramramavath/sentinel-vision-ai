import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Case, CaseSchema } from './schemas/case.schema';
import { Sighting, SightingSchema } from '../sightings/schemas/sighting.schema';
import { Camera, CameraSchema } from '../cameras/schemas/camera.schema';
import { CasesService } from './cases.service';
import { CasesController } from './cases.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Case.name, schema: CaseSchema },
      { name: Sighting.name, schema: SightingSchema },
      { name: Camera.name, schema: CameraSchema },
    ]),
  ],
  controllers: [CasesController],
  providers: [CasesService],
  exports: [CasesService, MongooseModule],
})
export class CasesModule {}
