import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { MobileUser, MobileUserSchema } from './schemas/mobile-user.schema';
import { MobileDevice, MobileDeviceSchema } from './schemas/mobile-device.schema';
import { StreamSession, StreamSessionSchema } from './schemas/stream-session.schema';
import { MobileInvite, MobileInviteSchema } from './schemas/mobile-invite.schema';
import { Camera, CameraSchema } from '../cameras/schemas/camera.schema';

import { MobileAuthService } from './services/mobile-auth.service';
import { MobileDevicesService } from './services/mobile-devices.service';
import { MobileAdminService } from './services/mobile-admin.service';

import { MobileAuthController } from './controllers/mobile-auth.controller';
import { MobileDevicesController } from './controllers/mobile-devices.controller';
import { MobileAdminController } from './controllers/mobile-admin.controller';

import { MobileJwtAuthGuard } from './guards/mobile-jwt-auth.guard';

import { RedisModule } from '../common/redis/redis.module';
import { KafkaModule } from '../common/kafka/kafka.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MobileUser.name, schema: MobileUserSchema },
      { name: MobileDevice.name, schema: MobileDeviceSchema },
      { name: StreamSession.name, schema: StreamSessionSchema },
      { name: MobileInvite.name, schema: MobileInviteSchema },
      { name: Camera.name, schema: CameraSchema },
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('app.jwtMobileSecret', 'sentinel-mobile-realm-secret-2026'),
        signOptions: { expiresIn: '15m' },
      }),
    }),
    RedisModule,
    KafkaModule,
    NotificationsModule,
    AuditModule,
  ],
  controllers: [
    MobileAuthController,
    MobileDevicesController,
    MobileAdminController,
  ],
  providers: [
    MobileAuthService,
    MobileDevicesService,
    MobileAdminService,
    MobileJwtAuthGuard,
  ],
  exports: [
    MobileAuthService,
    MobileDevicesService,
    MobileAdminService,
    MongooseModule,
  ],
})
export class MobileModule {}
