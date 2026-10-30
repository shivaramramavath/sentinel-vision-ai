import { MiddlewareConsumer, Module, NestModule, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule, InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { allConfigs } from './config';
import { validateApiEnv } from './config/env.validation';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { RedisModule } from './common/redis/redis.module';
import { KafkaModule } from './common/kafka/kafka.module';
import { StorageModule } from './common/storage/storage.module';
import { PineconeModule } from './common/pinecone/pinecone.module';
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
import { RbacModule } from './rbac/rbac.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: allConfigs,
      validate: validateApiEnv,
      envFilePath: ['.env', 'apps/api/.env', '../../.env', '../../.env.local'],
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('mongo.uri') || config.get<string>('app.mongoUri', 'mongodb://localhost:27017/sentinel_vision'),
        autoIndex: config.get<string>('server.nodeEnv') !== 'production',
        serverSelectionTimeoutMS: 5000,
      }),
    }),
    RedisModule,
    KafkaModule,
    StorageModule,
    PineconeModule,
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
    RbacModule,
  ],
})
export class AppModule implements NestModule, OnApplicationBootstrap {
  private readonly logger = new Logger(AppModule.name);

  constructor(@InjectConnection() private readonly connection: Connection) {}

  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }

  async onApplicationBootstrap(): Promise<void> {
    try {
      if (this.connection.readyState !== 1) {
        await this.connection.asPromise();
      }
      const adminDb = this.connection.db?.admin();
      if (adminDb) {
        const hello = await adminDb.command({ hello: 1 });
        const isReplicaSet = Boolean(hello.setName || hello.hosts);
        if (isReplicaSet) {
          this.logger.log(`MongoDB Atlas connected: ReplicaSet '${hello.setName || 'active'}' (Transactions supported)`);
        } else {
          this.logger.warn('MongoDB deployment is not in replica set mode. Multi-document transactions (Outbox pattern) require a replica set.');
        }
      }
    } catch (err: any) {
      if (
        err.message?.includes('buffering timed out') ||
        err.message?.includes('server selection timed out') ||
        err.name === 'MongooseServerSelectionError'
      ) {
        this.logger.error(
          'CRITICAL: MongoDB connection timed out. If using MongoDB Atlas, ensure your current public IP is whitelisted in Atlas Network Access (Network Access -> IP Access List).',
        );
      } else {
        this.logger.error(`MongoDB connection error: ${err.message}`);
      }
    }
  }
}
