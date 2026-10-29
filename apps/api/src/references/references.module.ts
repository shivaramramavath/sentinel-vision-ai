import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReferencesService } from './references.service';
import { ReferencesController } from './references.controller';
import { ReferenceImage, ReferenceImageSchema } from './schemas/reference-image.schema';
import { CasesModule } from '../cases/cases.module';
import { ReferenceSetsModule } from '../reference-sets/reference-sets.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ReferenceImage.name, schema: ReferenceImageSchema },
    ]),
    forwardRef(() => CasesModule),
    forwardRef(() => ReferenceSetsModule),
  ],
  controllers: [ReferencesController],
  providers: [ReferencesService],
  exports: [ReferencesService, MongooseModule],
})
export class ReferencesModule {}
