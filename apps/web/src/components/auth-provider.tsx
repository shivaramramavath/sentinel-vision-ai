'use client';

import React, { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { Skeleton } from '@/components/ui/skeleton';

const PUBLIC_AUTH_PATHS = [
  '/signin',
  '/login',
  '/register',
  '/verify-email',
  '/pending-approval',
  '/forgot-password',
  '/reset-password',
  '/auth/callback',
  '/m/',
];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, isCheckingAuth, refreshSession } = useAuthStore();
  const initialRefreshFired = useRef(false);

  // Trigger silent session restoration once on application mount
  useEffect(() => {
    if (!initialRefreshFired.current) {
      initialRefreshFired.current = true;
      refreshSession();
    }
  }, [refreshSession]);

  const isPublicPage = PUBLIC_AUTH_PATHS.some((path) => pathname.startsWith(path));
  const isRoot = pathname === '/';

  // Navigation guard effect after session restoration resolves
  useEffect(() => {
    if (isCheckingAuth) return;

    if (!isAuthenticated) {
      // Unauthenticated users attempting to access protected pages are sent to /login
      if (!isPublicPage && !isRoot) {
        router.replace('/login');
      }
    } else {
      // User is authenticated
      if (user?.status === 'pending_approval' && pathname !== '/pending-approval') {
        router.replace('/pending-approval');
        return;
      }

      // Authenticated active users on signin/login/register pages are redirected to /dashboard
      if (pathname === '/signin' || pathname === '/login' || pathname === '/register') {
        router.replace('/dashboard');
      }
    }
  }, [isAuthenticated, isCheckingAuth, isPublicPage, isRoot, user?.status, pathname, router]);

  // While restoring session:
  // Render loading skeleton for protected routes and root to avoid flashing protected content
  if (isCheckingAuth && !isPublicPage) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm space-y-4">
          <div className="flex items-center space-x-2">
            <span className="h-6 w-6 rounded bg-primary animate-pulse" />
            <span className="font-semibold tracking-wider text-sm">SENTINEL VISION AI</span>
          </div>
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  // Once resolved, if unauthenticated on a protected route, hold rendering until redirect finishes
  if (!isCheckingAuth && !isAuthenticated && !isPublicPage && !isRoot) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm space-y-4">
          <div className="flex items-center space-x-2">
            <span className="h-6 w-6 rounded bg-primary animate-pulse" />
            <span className="font-semibold tracking-wider text-sm">REDIRECTING...</span>
          </div>
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
