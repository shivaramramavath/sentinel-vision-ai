'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useMobileAuthStore } from '@/stores/mobile-auth.store';
import { Shield, Radio, Smartphone, User, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isCheckingAuth, refreshSession } = useMobileAuthStore();

  useEffect(() => {
    // Attempt silent session restoration from httpOnly cookie on load
    refreshSession();
  }, [refreshSession]);

  const isAuthRoute =
    pathname.includes('/m/register') ||
    pathname.includes('/m/verify') ||
    pathname.includes('/m/pending') ||
    pathname.includes('/m/login');

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between selection:bg-primary selection:text-primary-foreground max-w-md mx-auto border-x border-border/40 shadow-2xl relative">
      {/* Top Mobile Tactical Header */}
      <header className="h-14 border-b bg-background/95 backdrop-blur-md px-4 flex items-center justify-between sticky top-0 z-30">
        <Link href="/m/stream" className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <span className="font-bold text-sm tracking-tight">SENTINEL MOBILE</span>
        </Link>
        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-mono border border-emerald-500/30">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              OPERATOR ACTIVE
            </span>
          ) : (
            <span className="text-[10px] font-mono text-muted-foreground uppercase">
              TACTICAL BROADCAST
            </span>
          )}
        </div>
      </header>

      {/* Main Screen Body */}
      <main className="flex-1 p-4 pb-20 flex flex-col">
        {children}
      </main>

      {/* Bottom Navigation for Authenticated Operators */}
      {isAuthenticated && !isAuthRoute && (
        <nav
          aria-label="Mobile Operator Navigation"
          className="fixed bottom-0 left-0 right-0 max-w-md mx-auto h-16 border-t bg-background/95 backdrop-blur-md px-6 flex items-center justify-around z-30"
        >
          <Link
            href="/m/stream"
            className={cn(
              'flex flex-col items-center gap-1 text-[11px] font-medium transition-colors',
              pathname === '/m/stream'
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Radio className={cn('h-5 w-5', pathname === '/m/stream' && 'text-primary animate-pulse')} />
            <span>Broadcast</span>
          </Link>

          <Link
            href="/m/devices"
            className={cn(
              'flex flex-col items-center gap-1 text-[11px] font-medium transition-colors',
              pathname === '/m/devices'
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Smartphone className="h-5 w-5" />
            <span>Devices</span>
          </Link>

          <Link
            href="/m/profile"
            className={cn(
              'flex flex-col items-center gap-1 text-[11px] font-medium transition-colors',
              pathname === '/m/profile'
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <User className="h-5 w-5" />
            <span>Profile</span>
          </Link>
        </nav>
      )}
    </div>
  );
}
