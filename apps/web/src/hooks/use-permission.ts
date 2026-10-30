'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import {
  Permission,
  Role,
  RoleMeta,
  ROLE_META,
  RedactionLevel,
  getRedactionLevel,
  normalizeRole,
  isClearanceSufficient,
} from '@sentinel/shared-types';
import { apiClient } from '@/services/api.client';
import { useAuthStore } from '@/stores/auth.store';

export interface AbacContext {
  caseId?: string;
  assignedOfficerId?: string;
  assignedOfficer?: string;
  assignedTeam?: string;
  accessList?: string[];
  classification?: string;
  isMinor?: boolean;
  legalHoldActive?: boolean;
}

export interface MyPermissionsResponse {
  role: Role;
  permissions: Permission[];
  isBreakGlass: boolean;
  expiresAt?: string;
}

export function usePermission() {
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);

  const queryKey = useMemo(() => ['rbac', 'my-permissions'] as const, []);

  const { data, isLoading, isError, error, status: queryStatus } = useQuery<MyPermissionsResponse>({
    queryKey,
    queryFn: async () => {
      const res = await apiClient.get<MyPermissionsResponse>('/auth/me/permissions');
      return res.data;
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });

  const status: 'loading' | 'success' | 'error' =
    !isAuthenticated || isLoading || queryStatus === 'pending'
      ? 'loading'
      : isError || Boolean(error)
      ? 'error'
      : 'success';

  const role: Role = useMemo(() => {
    if (data?.role) return normalizeRole(data.role);
    if (user?.role) return normalizeRole(user.role);
    return 'viewer';
  }, [data?.role, user?.role]);

  const roleMeta: RoleMeta = useMemo(() => {
    return ROLE_META[role] || ROLE_META.viewer;
  }, [role]);

  const permissions: Permission[] = useMemo(() => {
    return data?.permissions || [];
  }, [data?.permissions]);

  const redactionLevel: RedactionLevel = useMemo(() => {
    return getRedactionLevel(role);
  }, [role]);

  const isBreakGlass = Boolean(data?.isBreakGlass);

  const invalidatePermissions = useCallback(() => {
    return queryClient.invalidateQueries({ queryKey: ['rbac', 'my-permissions'] });
  }, [queryClient]);

  /**
   * Evaluates if current user can perform an action given a granular permission and optional ABAC context.
   */
  const can = useCallback(
    (permission: Permission, context?: AbacContext): boolean => {
      // 1. RBAC check (exact or wildcard)
      const hasPerm =
        permissions.includes(permission) ||
        permissions.includes(`${permission.split(':')[0]}:*` as any);

      if (!hasPerm) {
        return false;
      }

      // 2. ABAC contextual check if context provided
      if (context) {
        // Reviewer role assigned case policy
        if (role === 'reviewer') {
          const userId = user?.id || (user as any)?._id;
          const userEmail = user?.email;
          const userTeam = (user as any)?.team || (user as any)?.department;

          const isAssigned =
            (context.assignedOfficerId && context.assignedOfficerId === userId) ||
            (context.assignedOfficer && (context.assignedOfficer === userId || context.assignedOfficer === userEmail)) ||
            (context.accessList && (context.accessList.includes(userId) || (userEmail && context.accessList.includes(userEmail))));

          const isTeamAssigned = userTeam && context.assignedTeam && userTeam === context.assignedTeam;

          if (!isAssigned && !isTeamAssigned && (context.assignedOfficerId || context.assignedTeam)) {
            return false;
          }
        }

        // Classification / Clearance check
        if (context.classification && (user as any)?.clearanceLevel) {
          if (!isClearanceSufficient((user as any).clearanceLevel, context.classification)) {
            return false;
          }
        }
      }

      return true;
    },
    [permissions, role, user],
  );

  const canAll = useCallback(
    (perms: Permission[]): boolean => {
      return perms.every((p) => can(p));
    },
    [can],
  );

  const canAny = useCallback(
    (perms: Permission[]): boolean => {
      return perms.some((p) => can(p));
    },
    [can],
  );

  return {
    can,
    canAll,
    canAny,
    permissions,
    role,
    roleMeta,
    redactionLevel,
    isBreakGlass,
    isLoading,
    status,
    error,
    invalidatePermissions,
    user,
  };
}
