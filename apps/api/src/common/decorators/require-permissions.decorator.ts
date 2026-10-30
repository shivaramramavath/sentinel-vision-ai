import { SetMetadata } from '@nestjs/common';
import { Permission } from '@sentinel/shared-types';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Decorator to require granular permissions on a route handler or controller.
 * Permissions are checked by PermissionsGuard.
 */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
