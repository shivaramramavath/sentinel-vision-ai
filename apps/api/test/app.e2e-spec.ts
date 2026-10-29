import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

describe('Sentinel Vision API (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  let refreshCookie: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  describe('Health Check', () => {
    it('/api/v1/health (GET) should return healthy status', () => {
      return request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('ok');
        });
    });
  });

  describe('Authentication Flow', () => {
    it('/api/v1/auth/login (POST) should reject bad credentials', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'sarah.vance@sentinel.gov', password: 'InvalidPassword' })
        .expect(401);
    });

    it('/api/v1/auth/login (POST) should succeed with valid credentials and set cookie', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'sarah.vance@sentinel.gov', password: 'Sentinel@2026' })
        .expect(200);

      expect(response.body.accessToken).toBeDefined();
      expect(response.body.user.role.toLowerCase()).toBe('investigator');
      accessToken = response.body.accessToken;

      const rawCookies: string | string[] | undefined = response.headers['set-cookie'];
      expect(rawCookies).toBeDefined();
      const cookiesList: string[] = Array.isArray(rawCookies) ? rawCookies : [String(rawCookies)];
      const rtCookie = cookiesList.find((c) => c.startsWith('sentinel_rt='));
      expect(rtCookie).toBeDefined();
      refreshCookie = (rtCookie as string).split(';')[0];
    });

    it('/api/v1/auth/me (GET) should return profile for authenticated user', () => {
      return request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.email).toBe('sarah.vance@sentinel.gov');
          expect(res.body.role.toLowerCase()).toBe('investigator');
        });
    });

    it('/api/v1/auth/refresh (POST) should rotate refresh token and return new access token', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', [refreshCookie])
        .expect(200);

      expect(response.body.accessToken).toBeDefined();
      accessToken = response.body.accessToken;

      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
    });
  });

  describe('Cases & Protected Routes', () => {
    it('/api/v1/cases (GET) should require Bearer authentication', () => {
      return request(app.getHttpServer())
        .get('/api/v1/cases')
        .expect(401);
    });

    it('/api/v1/cases (GET) should return seeded cases with Bearer token', () => {
      return request(app.getHttpServer())
        .get('/api/v1/cases')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThan(0);
          expect(res.body[0].caseNumber).toBeDefined();
        });
    });

    it('/api/v1/cameras (GET) should return seeded cameras', () => {
      return request(app.getHttpServer())
        .get('/api/v1/cameras')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThanOrEqual(124);
        });
    });

    it('/api/v1/sightings (GET) should return candidate sightings with separated face/reid metrics', () => {
      return request(app.getHttpServer())
        .get('/api/v1/sightings')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThan(0);
          const first = res.body[0];
          expect(first.faceScore).toBeDefined();
          expect(first.reidScore).toBeDefined();
          expect(first.model_version).toBe('v1.0');
        });
    });
  });
});
