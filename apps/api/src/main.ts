import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import * as path from 'path';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { RedisIoAdapter } from './common/adapters/redis-io.adapter';
import { QueueService } from './common/queues/queue.service';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  // Security headers with Helmet
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false, // Allows Swagger UI and local frame thumbnails
    }),
  );

  // Cookie parser for refresh token rotation cookies
  app.use(cookieParser());

  // Static uploads directory serving
  app.useStaticAssets(path.resolve(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });

  // WebSocket Redis Adapter for multi-replica broadcast
  const redisIoAdapter = new RedisIoAdapter(app);
  const redisHost = process.env.REDIS_HOST || 'localhost';
  const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
  await redisIoAdapter.connectToRedis(redisHost, redisPort);
  app.useWebSocketAdapter(redisIoAdapter);

  // Bull Board Admin Dashboard
  const queueService = app.get(QueueService);
  app.use('/admin/queues', queueService.serverAdapter.getRouter());

  // Global API prefix
  app.setGlobalPrefix('api/v1');

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
  const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
  app.enableCors({
    origin: [corsOrigin, 'http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID', 'x-correlation-id'],
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
    .addTag('References', 'Reference photos upload, resolution validation, MinIO pre-signed URLs')
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

  const port = process.env.API_PORT ? parseInt(process.env.API_PORT, 10) : 3001;
  await app.listen(port);
  logger.log(`🚀 Sentinel Vision API running on http://localhost:${port}/api/v1`);
  logger.log(`📚 Swagger documentation available at http://localhost:${port}/api/docs`);
  logger.log(`📊 Bull Board Queue Monitor available at http://localhost:${port}/admin/queues`);
}

bootstrap();
