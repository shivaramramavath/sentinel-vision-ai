import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MissingPerson, MissingPersonSchema } from './schemas/missing-person.schema';
import { ReferenceImage, ReferenceImageSchema } from '../references/schemas/reference-image.schema';
import { Case, CaseSchema } from '../cases/schemas/case.schema';
import { Sighting, SightingSchema } from '../sightings/schemas/sighting.schema';
import { MissingPersonsService } from './missing-persons.service';
import { MissingPersonsController } from './missing-persons.controller';
import { ReferenceSetsModule } from '../reference-sets/reference-sets.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MissingPerson.name, schema: MissingPersonSchema },
      { name: ReferenceImage.name, schema: ReferenceImageSchema },
      { name: Case.name, schema: CaseSchema },
      { name: Sighting.name, schema: SightingSchema },
    ]),
    forwardRef(() => ReferenceSetsModule),
  ],
  controllers: [MissingPersonsController],
  providers: [MissingPersonsService],
  exports: [MissingPersonsService, MongooseModule],
})
export class MissingPersonsModule {}
