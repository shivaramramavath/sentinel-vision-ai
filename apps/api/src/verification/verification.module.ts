import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';
import { SightingsModule } from '../sightings/sightings.module';
import { CasesModule } from '../cases/cases.module';
import { CamerasModule } from '../cameras/cameras.module';
import { RedisModule } from '../common/redis/redis.module';
import { VerificationLabel, VerificationLabelSchema } from './schemas/verification-label.schema';
import { Sighting, SightingSchema } from '../sightings/schemas/sighting.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: VerificationLabel.name, schema: VerificationLabelSchema },
      { name: Sighting.name, schema: SightingSchema },
    ]),
    SightingsModule,
    CasesModule,
    CamerasModule,
    RedisModule,
  ],
  controllers: [VerificationController],
  providers: [VerificationService],
  exports: [VerificationService],
})
export class VerificationModule {}
