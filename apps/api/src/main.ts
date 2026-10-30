import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'apps/api/.env') });

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { RedisIoAdapter } from './common/adapters/redis-io.adapter';
import { QueueService } from './common/queues/queue.service';
import { printMaskedConfig } from './config/utils/masked-config-printer';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Print masked config at startup (never leaking secrets)
  printMaskedConfig(process.env);

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  const configService = app.get(ConfigService);

  // Trust proxy if configured
  const trustProxy = configService.get<boolean>('server.trustProxy', false);
  if (trustProxy) {
    app.set('trust proxy', 1);
  }

  // Security headers with Helmet
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false, // Allows Swagger UI and frame thumbnails
    }),
  );

  // Cookie parser for refresh token rotation cookies
  const cookieSecret = configService.get<string>('auth.cookieSecret') || undefined;
  app.use(cookieParser(cookieSecret));

  // Static uploads directory serving
  app.useStaticAssets(path.resolve(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });

  // WebSocket Redis Adapter for multi-replica broadcast
  const redisIoAdapter = new RedisIoAdapter(app);
  const redisHost = configService.get<string>('redis.host', 'localhost');
  const redisPort = configService.get<number>('redis.port', 6379);
  const redisPassword = configService.get<string>('redis.password');
  const redisKeyPrefix = configService.get<string>('redis.keyPrefix', 'sentinel:');
  await redisIoAdapter.connectToRedis(redisHost, redisPort, redisPassword, redisKeyPrefix);
  app.useWebSocketAdapter(redisIoAdapter);

  // Bull Board Admin Dashboard
  const queueService = app.get(QueueService);
  app.use('/admin/queues', queueService.serverAdapter.getRouter());

  // Global API prefix
  const globalPrefix = configService.get<string>('server.globalPrefix', 'api/v1');
  app.setGlobalPrefix(globalPrefix);

  // Global Exception Filter with correlation tracking
  app.useGlobalFilters(new AllExceptionsFilter());

  // Global Request Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // CORS configuration
  const corsOrigins = configService.get<string[]>('server.corsOrigins', ['http://localhost:3000']);
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID', 'x-correlation-id', 'X-Internal-Service-Token'],
    exposedHeaders: ['X-Correlation-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
  });

  // Swagger OpenAPI Documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('SENTINEL VISION AI — API')
    .setDescription(
      'Core REST and WebSocket API for the SENTINEL VISION AI missing-person search and cross-camera tracking platform. Strictly outputs possible sightings for human verification.',
    )
    .setVersion('3.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter your 15-minute JWT access token',
        in: 'header',
      },
      'bearer',
    )
    .addTag('Auth', 'Authentication, token family rotation, reuse detection')
    .addTag('Cases', 'Missing person case lifecycle and access list management')
    .addTag('References', 'Reference photos upload, resolution validation, MinIO/Cloudinary pre-signed URLs')
    .addTag('Cameras', 'Surveillance camera stream status and RTSP endpoints')
    .addTag('Sightings', 'Possible sighting evidence with separated face and Re-ID metrics')
    .addTag('Journeys', 'Cross-camera movement trajectory reconstruction')
    .addTag('Verification', 'Human reviewer decision queue (confirm / reject / need more evidence)')
    .addTag('Evidence', 'Cryptographic SHA-256 chain of custody and frame crops')
    .addTag('Search', 'AI person search dispatch to Kafka workers and status polling')
    .addTag('Reports', 'Audit-ready investigation reports generation')
    .addTag('Audit', 'Immutable append-only access and verification audit trail')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = configService.get<number>('server.port', 3001);
  const host = configService.get<string>('server.host', '0.0.0.0');
  await app.listen(port, host);
  logger.log(`🚀 Sentinel Vision API running on http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/${globalPrefix}`);
  logger.log(`📚 Swagger documentation available at http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/api/docs`);
  logger.log(`📊 Bull Board Queue Monitor available at http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/admin/queues`);
}

bootstrap();
