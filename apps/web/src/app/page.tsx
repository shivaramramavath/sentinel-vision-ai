'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { Skeleton } from '@/components/ui/skeleton';

export default function RootPage() {
  const router = useRouter();
  const { isAuthenticated, isCheckingAuth } = useAuthStore();

  useEffect(() => {
    // Wait until session restoration check completes before redirecting
    if (!isCheckingAuth) {
      if (isAuthenticated) {
        router.replace('/dashboard');
      } else {
        router.replace('/signin');
      }
    }
  }, [isCheckingAuth, isAuthenticated, router]);

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
