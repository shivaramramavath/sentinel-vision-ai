import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';
import { AuditService } from '../audit.service';
import { AUDIT_METADATA_KEY, AuditActionOptions } from '../decorators/audit-action.decorator';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const options = this.reflector.getAllAndOverride<AuditActionOptions>(
      AUDIT_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!options) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request & { user?: any }>();

    return next.handle().pipe(
      tap((responseBody) => {
        // Extract actor from authenticated request
        const user = request.user || {
          id: 'anonymous',
          email: 'anonymous@sentinel.local',
          role: 'Viewer',
        };

        let entityId = request.params?.id || request.body?.id || 'unknown';
        if (options.extractEntityId) {
          try {
            entityId = options.extractEntityId(request, responseBody);
          } catch {
            // fallback to default entityId
          }
        }

        const ipAddress = request.ip || request.socket.remoteAddress || 'unknown';
        const userAgent = request.headers['user-agent'] || 'unknown';
        const correlationId = request.correlationId || (request.headers['x-correlation-id'] as string) || 'none';

        // Write append-only immutable audit record
        this.auditService.recordLog({
          actor: {
            userId: user.id || user._id?.toString() || 'unknown',
            email: user.email || 'unknown',
            role: user.role || 'Viewer',
          },
          action: options.action,
          entity: {
            type: options.entityType,
            id: String(entityId),
          },
          ipAddress,
          userAgent,
          correlationId,
          metadata: {
            method: request.method,
            path: request.url,
            query: request.query,
          },
        }).catch(() => null);
      }),
    );
  }
}
