'use client';

import { useMemo } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { UserRole } from '@/types';

export type Permission =
  | 'manage_users'
  | 'manage_roles'
  | 'manage_system'
  | 'create_case'
  | 'edit_case'
  | 'delete_case'
  | 'verify_sighting'
  | 'export_evidence'
  | 'view_audit_logs'
  | 'manage_alerts'
  | 'stream_mobile';

function normalizeRole(role?: string): string {
  if (!role) return '';
  return role.toLowerCase().replace(/\s+/g, '_');
}

export function usePermission() {
  const user = useAuthStore((s) => s.user);
  const normalizedRole = useMemo(() => normalizeRole(user?.role), [user?.role]);

  const permissions = useMemo(() => {
    const isSuperAdmin = normalizedRole === 'super_admin';
    const isInvestigator = normalizedRole === 'investigator';
    const isReviewer = normalizedRole === 'reviewer';
    const isMobileOperator = normalizedRole === 'mobile_operator';

    return {
      manage_users: isSuperAdmin,
      manage_roles: isSuperAdmin,
      manage_system: isSuperAdmin,
      create_case: isSuperAdmin || isInvestigator,
      edit_case: isSuperAdmin || isInvestigator,
      delete_case: isSuperAdmin,
      verify_sighting: isSuperAdmin || isInvestigator || isReviewer,
      export_evidence: isSuperAdmin || isInvestigator,
      view_audit_logs: isSuperAdmin || isInvestigator,
      manage_alerts: isSuperAdmin || isInvestigator,
      stream_mobile: isSuperAdmin || isMobileOperator,
    };
  }, [normalizedRole]);

  const hasPermission = (permission: Permission): boolean => {
    return !!permissions[permission];
  };

  const hasAnyRole = (roles: (UserRole | string)[]): boolean => {
    const normalizedTargets = roles.map((r) => normalizeRole(r));
    return normalizedTargets.includes(normalizedRole);
  };

  const isAdmin = normalizedRole === 'super_admin';
  const isInvestigator = normalizedRole === 'investigator';
  const isReviewer = normalizedRole === 'reviewer';
  const isViewer = normalizedRole === 'viewer';
  const isMobileOperator = normalizedRole === 'mobile_operator';

  return {
    permissions,
    hasPermission,
    hasAnyRole,
    isAdmin,
    isInvestigator,
    isReviewer,
    isViewer,
    isMobileOperator,
    role: user?.role,
    user,
  };
}
