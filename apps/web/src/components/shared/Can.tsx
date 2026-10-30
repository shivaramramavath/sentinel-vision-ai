'use client';

import React from 'react';
import { Permission } from '@sentinel/shared-types';
import { usePermission, AbacContext } from '@/hooks/use-permission';

export interface CanProps {
  permission: Permission;
  context?: AbacContext;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Declarative component for granular permission gating.
 * Renders `children` only if the authenticated user has the required permission
 * and passes the optional ABAC context evaluation.
 */
export function Can({ permission, context, children, fallback = null }: CanProps) {
  const { can, isLoading } = usePermission();

  if (isLoading) {
    return null;
  }

  if (can(permission, context)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}
