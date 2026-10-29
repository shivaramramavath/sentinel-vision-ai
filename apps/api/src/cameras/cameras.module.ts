import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Camera, CameraSchema } from './schemas/camera.schema';
import {
  CameraTopology,
  CameraTopologySchema,
} from './schemas/camera-topology.schema';
import {
  VideoSegment,
  VideoSegmentSchema,
} from './schemas/video-segment.schema';
import { CamerasService } from './cameras.service';
import { CameraHealthPollerService } from './services/camera-health-poller.service';
import { PlaybackStreamingService } from './services/playback-streaming.service';
import { StorageLifecycleService } from './services/storage-lifecycle.service';
import { CamerasController } from './cameras.controller';
import { RedisModule } from '../common/redis/redis.module';
import { KafkaModule } from '../common/kafka/kafka.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MediaModule } from '../media/media.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Camera.name, schema: CameraSchema },
      { name: CameraTopology.name, schema: CameraTopologySchema },
      { name: VideoSegment.name, schema: VideoSegmentSchema },
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('app.jwtSecret', 'dev-secret-change-in-production'),
        signOptions: { expiresIn: '60s' },
      }),
    }),
    RedisModule,
    KafkaModule,
    NotificationsModule,
    forwardRef(() => MediaModule),
  ],
  controllers: [CamerasController],
  providers: [
    CamerasService,
    CameraHealthPollerService,
    PlaybackStreamingService,
    StorageLifecycleService,
  ],
  exports: [
    CamerasService,
    PlaybackStreamingService,
    StorageLifecycleService,
    MongooseModule,
  ],
})
export class CamerasModule {}
