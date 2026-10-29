import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { MediaMtxControlService } from './services/mediamtx-control.service';
import { CamerasModule } from '../cameras/cameras.module';
import { KafkaModule } from '../common/kafka/kafka.module';
import { RedisModule } from '../common/redis/redis.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('app.jwtSecret', 'dev-secret-change-in-production'),
        signOptions: { expiresIn: '1d' },
      }),
    }),
    forwardRef(() => CamerasModule),
    KafkaModule,
    RedisModule,
    NotificationsModule,
  ],
  controllers: [MediaController],
  providers: [MediaService, MediaMtxControlService],
  exports: [MediaService, MediaMtxControlService],
})
export class MediaModule {}

