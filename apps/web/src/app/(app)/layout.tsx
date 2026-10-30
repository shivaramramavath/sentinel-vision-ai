'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar, ROUTE_PERMISSIONS } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { CmdKDialog } from '@/components/layout/cmd-k';
import { useUiStore } from '@/stores/ui.store';
import { useAuthStore } from '@/stores/auth.store';
import { usePermission } from '@/hooks/use-permission';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { wallMode } = useUiStore();
  const { isAuthenticated, isCheckingAuth } = useAuthStore();
  const { can, role, roleMeta, isLoading: isRbacLoading } = usePermission();
  const pathname = usePathname();
  const router = useRouter();

  // Route-level RBAC redirect guard
  useEffect(() => {
    if (!isAuthenticated || isCheckingAuth || isRbacLoading) return;

    // Check if current route requires a specific permission
    for (const [routePrefix, requiredPerm] of Object.entries(ROUTE_PERMISSIONS)) {
      if (pathname.startsWith(routePrefix)) {
        if (!can(requiredPerm)) {
          const destination = roleMeta.landing || '/dashboard';
          if (pathname !== destination) {
            router.replace(destination);
          }
        }
        break;
      }
    }
  }, [pathname, isAuthenticated, isCheckingAuth, isRbacLoading, can, roleMeta, router]);

  // Guard: Never render protected layout while session restoration is pending or unauthenticated
  if (isCheckingAuth || !isAuthenticated) {
    return null;
  }

  if (wallMode) {
    // In wall mode (for large monitoring centers), hide sidebar and topbar
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <CmdKDialog />
        <main className="flex-1 p-2">{children}</main>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <CmdKDialog />
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
