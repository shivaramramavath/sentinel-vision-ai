import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReferenceSet, ReferenceSetSchema } from './schemas/reference-set.schema';
import { ReferenceImage, ReferenceImageSchema } from '../references/schemas/reference-image.schema';
import { MissingPerson, MissingPersonSchema } from '../missing-persons/schemas/missing-person.schema';
import { ReferenceSetsService } from './reference-sets.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ReferenceSet.name, schema: ReferenceSetSchema },
      { name: ReferenceImage.name, schema: ReferenceImageSchema },
      { name: MissingPerson.name, schema: MissingPersonSchema },
    ]),
  ],
  providers: [ReferenceSetsService],
  exports: [ReferenceSetsService, MongooseModule],
})
export class ReferenceSetsModule {}
