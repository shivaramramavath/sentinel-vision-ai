import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import appConfig from './config/app.config';
import { validateApiEnv } from './config/env.validation';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { RedisModule } from './common/redis/redis.module';
import { KafkaModule } from './common/kafka/kafka.module';
import { StorageModule } from './common/storage/storage.module';
import { OutboxModule } from './common/outbox/outbox.module';
import { QueueModule } from './common/queues/queue.module';
import { AuditModule } from './audit/audit.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { CasesModule } from './cases/cases.module';
import { MissingPersonsModule } from './missing-persons/missing-persons.module';
import { ReferencesModule } from './references/references.module';
import { ReferenceSetsModule } from './reference-sets/reference-sets.module';
import { CamerasModule } from './cameras/cameras.module';
import { SightingsModule } from './sightings/sightings.module';
import { JourneysModule } from './journeys/journeys.module';
import { VerificationModule } from './verification/verification.module';
import { EvidenceModule } from './evidence/evidence.module';
import { ReportsModule } from './reports/reports.module';
import { SearchJobsModule } from './search-jobs/search-jobs.module';
import { AlertsModule } from './alerts/alerts.module';
import { NotificationsModule } from './notifications/notifications.module';
import { HealthModule } from './health/health.module';
import { MediaModule } from './media/media.module';
import { MobileModule } from './mobile/mobile.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AdminModule } from './admin/admin.module';
import { EmailModule } from './modules/email/email.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      validate: validateApiEnv,
      envFilePath: ['../../.env', '../../.env.local', '.env'],
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('app.mongoUri', 'mongodb://localhost:27017/sentinel_vision'),
        serverSelectionTimeoutMS: 5000,
      }),
    }),
    RedisModule,
    KafkaModule,
    StorageModule,
    OutboxModule,
    QueueModule,
    AuditModule,
    UsersModule,
    AuthModule,
    CasesModule,
    MissingPersonsModule,
    ReferencesModule,
    ReferenceSetsModule,
    CamerasModule,
    SightingsModule,
    JourneysModule,
    VerificationModule,
    EvidenceModule,
    ReportsModule,
    SearchJobsModule,
    AlertsModule,
    NotificationsModule,
    HealthModule,
    MediaModule,
    MobileModule,
    DashboardModule,
    AdminModule,
    EmailModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
