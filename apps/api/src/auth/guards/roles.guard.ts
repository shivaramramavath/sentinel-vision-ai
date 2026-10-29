import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from '../../users/schemas/user.schema';

const ROLE_PRIORITY: Record<UserRole, number> = {
  super_admin: 4,
  'Super Admin': 4,
  investigator: 3,
  Investigator: 3,
  reviewer: 2,
  Reviewer: 2,
  viewer: 1,
  Viewer: 1,
  mobile_operator: 1,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user || !user.role) {
      return false;
    }

    // Direct match or hierarchy
    const userPriority = ROLE_PRIORITY[user.role as UserRole] || 0;
    return requiredRoles.some((role) => {
      if (user.role === role) return true;
      const targetPriority = ROLE_PRIORITY[role] || 0;
      return userPriority >= targetPriority;
    });
  }
}
