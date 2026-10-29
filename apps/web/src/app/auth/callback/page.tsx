'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth.store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, ShieldCheck } from 'lucide-react';

function AuthCallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const statusParam = searchParams.get('status');
  const { refreshSession } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (statusParam === 'error') {
      setError('OAuth authentication was cancelled or rejected by identity provider.');
      return;
    }

    let isMounted = true;

    refreshSession()
      .then((success) => {
        if (!isMounted) return;
        if (success) {
          const user = useAuthStore.getState().user;
          if (user?.status === 'pending_approval' || statusParam === 'pending_approval') {
            router.replace('/pending-approval');
          } else {
            router.replace('/dashboard');
          }
        } else {
          setError('Failed to establish security session from authentication ticket.');
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err?.message || 'Authentication ticket resolution failed.');
      });

    return () => {
      isMounted = false;
    };
  }, [statusParam, refreshSession, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg border bg-card text-2xl font-bold shadow-sm font-mono">
            ⬡
          </div>
          <h1 className="text-2xl font-bold tracking-tight">SENTINEL VISION AI</h1>
        </div>

        <Card className="border-border">
          <CardHeader className="text-center pb-4">
            {!error ? (
              <div className="mx-auto my-2 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="mx-auto my-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive border border-destructive/20">
                <AlertTriangle className="h-6 w-6" />
              </div>
            )}

            <CardTitle className="text-lg">
              {!error ? 'Finalizing Authentication...' : 'Authentication Failed'}
            </CardTitle>
            <CardDescription className="text-xs">
              {!error
                ? 'Securing single-sign-on cryptographic handshake...'
                : error}
            </CardDescription>
          </CardHeader>

          {error && (
            <CardFooter className="pt-0">
              <Button asChild className="w-full h-9 text-xs">
                <Link href="/login">Return to Sign-In</Link>
              </Button>
            </CardFooter>
          )}
        </Card>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
