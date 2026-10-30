import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { RedisService } from '../../common/redis/redis.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: any }>();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.split(' ')[1];
    try {
      const secret =
        this.configService.get<string>('auth.jwtAccessSecret') ||
        this.configService.get<string>('app.jwtAccessSecret');

      if (!secret) {
        throw new UnauthorizedException('JWT access secret is not configured');
      }

      const payload = await this.jwtService.verifyAsync(token, { secret });

      // 1. Check if token JTI is denylisted in Redis (from logout/logout-all)
      // Fail closed for auth if Redis is down
      if (payload.jti) {
        if (!this.redisService.isHealthy()) {
          throw new UnauthorizedException('Authentication session store is temporarily unavailable');
        }
        const isDenylisted = await this.redisService.get(`denylist:jti:${payload.jti}`);
        if (isDenylisted) {
          throw new UnauthorizedException('Token has been revoked');
        }
      }

      // 2. Reject mobile audience tokens on web/dashboard routes; reject web tokens on mobile ingest routes
      const url = request.originalUrl || request.url || '';
      const isMobileIngestRoute = url.includes('/api/v1/mobile') || url.includes('/mobile') || url.includes('/ingest/devices');
      const isMobileAdminRoute = url.includes('/admin/mobile');

      if (payload.aud === 'mobile' && !isMobileIngestRoute) {
        throw new ForbiddenException({
          statusCode: 403,
          error: 'Forbidden',
          code: 'REALM_MISMATCH',
          message: 'Mobile stream credentials not authorized for command console APIs',
        });
      }

      if (payload.aud === 'web' && isMobileIngestRoute && !isMobileAdminRoute) {
        throw new ForbiddenException({
          statusCode: 403,
          error: 'Forbidden',
          code: 'REALM_MISMATCH',
          message: 'Web console credentials not authorized for mobile streaming routes',
        });
      }

      // 3. Invalidate token if user's permissions / role were changed in Redis
      if (this.redisService && typeof this.redisService.isHealthy === 'function' && this.redisService.isHealthy()) {
        const permVersionKey = `user:permVersion:${payload.sub}`;
        const currentVersionStr = await this.redisService.get(permVersionKey);
        if (currentVersionStr) {
          const currentVersion = parseInt(currentVersionStr, 10);
          const tokenVersion = payload.permVersion || 0;
          if (currentVersion > tokenVersion) {
            throw new UnauthorizedException({
              statusCode: 401,
              error: 'Unauthorized',
              code: 'TOKEN_STALE',
              message: 'Permissions have changed. Token refresh required.',
            });
          }
        }
      }

      // 4. Block all API endpoints (except logout and setup endpoints) if mandatory security setup is pending
      if (payload.mustChangePassword || payload.mfaEnrollmentRequired) {
        const isAllowed =
          url.includes('/auth/logout') ||
          url.includes('/auth/logout-all') ||
          url.includes('/auth/change-password') ||
          url.includes('/auth/mfa/setup') ||
          url.includes('/auth/mfa/enable') ||
          url.includes('/auth/refresh') ||
          url.includes('/users/me');

        if (!isAllowed) {
          throw new ForbiddenException(
            'Mandatory security setup pending: password change and MFA enrollment required before accessing console APIs',
          );
        }
      }

      request.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        fullName: payload.fullName || payload.name,
        sessionId: payload.sessionId,
        jti: payload.jti,
        aud: payload.aud,
        mustChangePassword: Boolean(payload.mustChangePassword),
        mfaEnrollmentRequired: Boolean(payload.mfaEnrollmentRequired),
      };

      return true;
    } catch (err: any) {
      if (err instanceof UnauthorizedException || err instanceof ForbiddenException) {
        throw err;
      }
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
