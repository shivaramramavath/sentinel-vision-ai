import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Sighting, SightingSchema } from './schemas/sighting.schema';
import { HardNegative, HardNegativeSchema } from './schemas/hard-negative.schema';
import { SightingsService } from './sightings.service';
import { SightingsController } from './sightings.controller';
import { CasesModule } from '../cases/cases.module';
import { ReferencesModule } from '../references/references.module';
import { MissingPersonsModule } from '../missing-persons/missing-persons.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Sighting.name, schema: SightingSchema },
      { name: HardNegative.name, schema: HardNegativeSchema },
    ]),
    CasesModule,
    forwardRef(() => ReferencesModule),
    forwardRef(() => MissingPersonsModule),
  ],
  controllers: [SightingsController],
  providers: [SightingsService],
  exports: [SightingsService, MongooseModule],
})
export class SightingsModule {}
