import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Evidence, EvidenceSchema } from './schemas/evidence.schema';
import { EvidenceService } from './evidence.service';
import { EvidenceController } from './evidence.controller';
import { StorageModule } from '../common/storage/storage.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Evidence.name, schema: EvidenceSchema }]),
    StorageModule,
  ],
  controllers: [EvidenceController],
  providers: [EvidenceService],
  exports: [EvidenceService, MongooseModule],
})
export class EvidenceModule {}
