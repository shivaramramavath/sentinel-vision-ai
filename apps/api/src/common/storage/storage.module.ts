import { Global, Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { StorageService } from './storage.service';
import { StorageController } from './storage.controller';
import { CloudinaryStorageProvider } from './providers/cloudinary-storage.provider';
import { MinioStorageProvider } from './providers/minio-storage.provider';
import { MediaAsset, MediaAssetSchema } from './schemas/media-asset.schema';
import { AuditModule } from '../../audit/audit.module';
import { KafkaModule } from '../kafka/kafka.module';
import { storageConfig } from '../../config/storage.config';

/** Injection token for the active StorageProvider. */
export const STORAGE_PROVIDER = 'STORAGE_PROVIDER';

@Global()
@Module({
  imports: [
    ConfigModule.forFeature(storageConfig),
    MongooseModule.forFeature([{ name: MediaAsset.name, schema: MediaAssetSchema }]),
    AuditModule,
    KafkaModule,
  ],
  controllers: [StorageController],
  providers: [
    CloudinaryStorageProvider,
    // MinioStorageProvider is only instantiated when needed by the factory below.
    MinioStorageProvider,
    {
      provide: STORAGE_PROVIDER,
      inject: [ConfigService, CloudinaryStorageProvider, MinioStorageProvider],
      useFactory: (
        configService: ConfigService,
        cloudinary: CloudinaryStorageProvider,
        minio: MinioStorageProvider,
      ) => {
        const logger = new Logger('StorageModule');
        const driver = configService.get<string>('storage.driver', 'cloudinary');
        if (driver === 'minio') {
          logger.log('Storage driver selected: MinIO');
          return minio;
        }
        logger.log('Storage driver selected: Cloudinary');
        return cloudinary;
      },
    },
    StorageService,
  ],
  exports: [StorageService, STORAGE_PROVIDER],
})
export class StorageModule {}
