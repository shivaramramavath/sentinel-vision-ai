import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission, isStepUpPermission } from '@sentinel/shared-types';
import { PERMISSIONS_KEY } from '../../common/decorators/require-permissions.decorator';
import { REQUIRE_STEP_UP_KEY } from '../../common/decorators/require-step-up.decorator';
import { RbacService } from '../rbac.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbacService: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    const isStepUpExplicitlyRequired = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_STEP_UP_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no permissions are specified and no step-up requested, pass
    if ((!requiredPermissions || requiredPermissions.length === 0) && !isStepUpExplicitlyRequired) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.role) {
      throw new UnauthorizedException('Authentication required');
    }

    // 1. Fetch effective user permissions
    const { permissions, role, isBreakGlass } =
      await this.rbacService.getUserEffectivePermissions(user.id, user.role);

    // Attach enriched permissions and break-glass metadata to request
    request.user.role = role;
    request.user.permissions = permissions;
    request.user.isBreakGlass = isBreakGlass;

    // 2. Check each required permission
    if (requiredPermissions && requiredPermissions.length > 0) {
      for (const reqPerm of requiredPermissions) {
        if (!this.rbacService.hasPermission(permissions, reqPerm)) {
          throw new ForbiddenException({
            statusCode: 403,
            error: 'Forbidden',
            code: 'PERMISSION_DENIED',
            permission: reqPerm,
            reason: `Missing required permission: ${reqPerm}`,
          });
        }
      }
    }

    // 3. Step-up validation
    const hasStepUpPermission =
      Boolean(isStepUpExplicitlyRequired) ||
      (requiredPermissions && requiredPermissions.some((p) => isStepUpPermission(p)));

    if (hasStepUpPermission) {
      const stepUpHeader =
        (request.headers['x-step-up-token'] as string) ||
        (request.headers['x-step-up'] as string);

      const isValidStepUp = await this.rbacService.validateStepUp(
        user.id,
        user.sessionId,
        stepUpHeader,
      );

      if (!isValidStepUp) {
        throw new ForbiddenException({
          statusCode: 403,
          error: 'Forbidden',
          code: 'STEP_UP_REQUIRED',
          message:
            'Elevated operation requires step-up authentication within the last 5 minutes.',
          stepUpRequired: true,
        });
      }
    }

    return true;
  }
}
