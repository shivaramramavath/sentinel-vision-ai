import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class InternalServiceGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token =
      request.headers['x-internal-service-token'] ||
      (request.headers.authorization?.startsWith('Bearer ')
        ? request.headers.authorization.split(' ')[1]
        : null);

    const configuredSecret = this.configService.get<string>(
      'app.internalServiceToken',
      'dev-internal-service-token-2026',
    );

    if (!token || token !== configuredSecret) {
      throw new UnauthorizedException('Invalid or missing internal service token');
    }

    return true;
  }
}
