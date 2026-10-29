import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private minioClient: Minio.Client | null = null;
  private isMinioAvailable = false;
  private readonly fallbackStoragePath = path.resolve(process.cwd(), 'uploads');

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    // Ensure fallback local upload directory exists
    if (!fs.existsSync(this.fallbackStoragePath)) {
      fs.mkdirSync(this.fallbackStoragePath, { recursive: true });
    }

    const endpoint = this.configService.get<string>('app.minioEndpoint', 'localhost');
    const port = this.configService.get<number>('app.minioPort', 9000);
    const useSSL = this.configService.get<boolean>('app.minioUseSsl', false);
    const accessKey = this.configService.get<string>('app.minioAccessKey', 'minioadmin');
    const secretKey = this.configService.get<string>('app.minioSecretKey', 'minioadmin');

    try {
      this.minioClient = new Minio.Client({
        endPoint: endpoint,
        port,
        useSSL,
        accessKey,
        secretKey,
      });

      // Probe MinIO bucket
      const bucketName = this.configService.get<string>('app.minioBucketPhotos', 'reference-photos');
      const exists = await this.minioClient.bucketExists(bucketName).catch(() => false);
      if (!exists && this.minioClient) {
        await this.minioClient.makeBucket(bucketName, 'us-east-1').catch(() => null);
      }
      this.isMinioAvailable = true;
      this.logger.log(`MinIO storage connected at ${endpoint}:${port}`);
    } catch (err: any) {
      this.logger.warn(`MinIO unavailable (${err.message}). Using local storage fallback at ${this.fallbackStoragePath}`);
      this.isMinioAvailable = false;
    }
  }

  async uploadFile(
    bucket: string,
    objectName: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<string> {
    if (this.isMinioAvailable && this.minioClient) {
      try {
        const exists = await this.minioClient.bucketExists(bucket).catch(() => false);
        if (!exists) {
          await this.minioClient.makeBucket(bucket, 'us-east-1').catch(() => null);
        }
        await this.minioClient.putObject(bucket, objectName, buffer, buffer.length, {
          'Content-Type': contentType,
        });
        return await this.getPresignedUrl(bucket, objectName);
      } catch (err: any) {
        this.logger.warn(`MinIO putObject failed: ${err.message}. Falling back to local disk.`);
      }
    }

    // Local disk fallback
    const bucketDir = path.join(this.fallbackStoragePath, bucket);
    if (!fs.existsSync(bucketDir)) {
      fs.mkdirSync(bucketDir, { recursive: true });
    }
    const filePath = path.join(bucketDir, objectName);
    fs.writeFileSync(filePath, buffer);

    const apiPort = this.configService.get<number>('app.port', 3001);
    return `http://localhost:${apiPort}/uploads/${bucket}/${objectName}`;
  }

  async getPresignedUrl(bucket: string, objectName: string, expirySec = 24 * 3600): Promise<string> {
    if (this.isMinioAvailable && this.minioClient) {
      try {
        return await this.minioClient.presignedGetObject(bucket, objectName, expirySec);
      } catch (err: any) {
        this.logger.warn(`MinIO presigned URL error: ${err.message}`);
      }
    }

    const apiPort = this.configService.get<number>('app.port', 3001);
    return `http://localhost:${apiPort}/uploads/${bucket}/${objectName}`;
  }

  async getPresignedUploadUrl(bucket: string, objectName: string, expirySec = 300): Promise<string> {
    if (this.isMinioAvailable && this.minioClient) {
      try {
        const exists = await this.minioClient.bucketExists(bucket).catch(() => false);
        if (!exists) {
          await this.minioClient.makeBucket(bucket, 'us-east-1').catch(() => null);
        }
        return await this.minioClient.presignedPutObject(bucket, objectName, expirySec);
      } catch (err: any) {
        this.logger.warn(`MinIO presigned PUT error: ${err.message}`);
      }
    }

    const apiPort = this.configService.get<number>('app.port', 3001);
    return `http://localhost:${apiPort}/uploads/${bucket}/${objectName}`;
  }

  async deleteObject(bucket: string, objectName: string): Promise<boolean> {
    if (this.isMinioAvailable && this.minioClient) {
      try {
        await this.minioClient.removeObject(bucket, objectName);
        return true;
      } catch (err: any) {
        this.logger.warn(`MinIO removeObject error: ${err.message}`);
      }
    }
    const filePath = path.join(this.fallbackStoragePath, bucket, objectName);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        return true;
      } catch {}
    }
    return false;
  }
}
