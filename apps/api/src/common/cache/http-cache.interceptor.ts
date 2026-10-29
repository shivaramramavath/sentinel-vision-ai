import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class HttpCacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(HttpCacheInterceptor.name);

  constructor(private readonly redisService: RedisService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;
    const url = request.originalUrl || request.url;

    // Only cache safe idempotent GET requests for hot entities
    const isHotRoute =
      url.includes('/api/v1/cases') ||
      url.includes('/api/v1/cameras') ||
      url.includes('/api/v1/locations');

    if (method === 'GET' && isHotRoute) {
      const cacheKey = `cache:http:${url}`;
      const cached = await this.redisService.get(cacheKey);

      if (cached) {
        this.logger.debug(`[CACHE HIT] ${url}`);
        try {
          return of(JSON.parse(cached));
        } catch {
          // fall through
        }
      }

      return next.handle().pipe(
        tap(async (response) => {
          if (response) {
            // Cache for 30 seconds
            await this.redisService.setnx(cacheKey, JSON.stringify(response), 30);
          }
        }),
      );
    }

    // Invalidation on write mutations
    if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method) && isHotRoute) {
      if (url.includes('/cases')) {
        await this.redisService.del('cache:http:/api/v1/cases');
      }
      if (url.includes('/cameras')) {
        await this.redisService.del('cache:http:/api/v1/cameras');
      }
    }

    return next.handle();
  }
}
