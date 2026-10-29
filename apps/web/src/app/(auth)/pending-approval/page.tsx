'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, RefreshCw, LogOut, ShieldAlert, CheckCircle2 } from 'lucide-react';

export default function PendingApprovalPage() {
  const router = useRouter();
  const { user, refreshSession, logout } = useAuthStore();
  const [checking, setChecking] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleCheckStatus = async () => {
    setChecking(true);
    setStatusMessage(null);
    try {
      const active = await refreshSession();
      const currentUser = useAuthStore.getState().user;
      if (active && currentUser && (currentUser.status === 'active' || !currentUser.status)) {
        router.replace('/dashboard');
        return;
      }
      setStatusMessage('Account status: Pending Administrator Approval. Please check back later.');
    } catch {
      setStatusMessage('Unable to connect to authorization server. Please try again.');
    } finally {
      setChecking(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

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
            <div className="mx-auto my-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <Clock className="h-6 w-6" />
            </div>
            <div className="flex items-center justify-center gap-2">
              <CardTitle className="text-lg">Account Under Review</CardTitle>
              <Badge variant="outline" className="font-mono text-[10px] text-amber-500 border-amber-500/30">
                PENDING APPROVAL
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Your official identity has been verified. A system administrator must approve your clearance level.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {statusMessage && (
              <div className="rounded-md border border-border bg-muted/60 p-3 text-xs flex items-center gap-2 text-foreground">
                <ShieldAlert className="h-4 w-4 shrink-0 text-amber-500" />
                <span>{statusMessage}</span>
              </div>
            )}

            <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2 text-xs text-muted-foreground">
              <div className="flex justify-between items-center text-foreground font-medium">
                <span>Application Identity:</span>
                <span className="font-mono text-xs">{user?.email || 'Authenticated User'}</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                By statutory regulation, access to live cross-camera tracking and biometric identification requires
                verified supervisor sign-off. You will receive an automated notification once approved.
              </p>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-2 pt-0">
            <Button
              onClick={handleCheckStatus}
              disabled={checking}
              className="w-full h-9 text-xs font-medium"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
              Refresh Status
            </Button>

            <Button
              variant="outline"
              onClick={handleLogout}
              className="w-full h-9 text-xs"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
