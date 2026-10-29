import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
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
        this.configService.get<string>('app.jwtAccessSecret') ||
        this.configService.get<string>('app.jwtSecret') ||
        'dev-secret-change-in-production';

      const payload = await this.jwtService.verifyAsync(token, { secret });

      // 1. Check if token JTI is denylisted in Redis (from logout/logout-all)
      if (payload.jti) {
        const isDenylisted = await this.redisService.get(`denylist:jti:${payload.jti}`);
        if (isDenylisted) {
          throw new UnauthorizedException('Token has been revoked');
        }
      }

      // 2. Reject mobile audience tokens on web/dashboard routes
      if (payload.aud === 'mobile') {
        throw new UnauthorizedException('Mobile stream credentials not authorized for command console APIs');
      }

      request.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        fullName: payload.fullName || payload.name,
        sessionId: payload.sessionId,
        jti: payload.jti,
        aud: payload.aud,
      };

      return true;
    } catch (err: any) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
