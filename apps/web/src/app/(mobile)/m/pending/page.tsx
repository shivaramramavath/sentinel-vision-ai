'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Clock, RefreshCw, Loader2 } from 'lucide-react';

function MobilePendingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';

  const [isChecking, setIsChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleCheckStatus = async () => {
    setIsChecking(true);
    setMessage(null);
    try {
      // Direct user to login check
      router.push(`/m/login${email ? `?email=${encodeURIComponent(email)}` : ''}`);
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-center py-6">
      <Card className="border-border shadow-sm text-center">
        <CardHeader className="space-y-3 p-6 pb-2">
          <div className="mx-auto h-16 w-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
            <Clock className="h-8 w-8 animate-pulse" />
          </div>
          <CardTitle className="text-lg font-bold">Awaiting Administrator Approval</CardTitle>
          <CardDescription className="text-xs max-w-xs mx-auto leading-relaxed">
            Your identity has been verified. In compliance with statutory search protocols, a
            Command Center supervisor must approve your mobile account before camera streaming is unlocked.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-6 pt-4 space-y-4">
          <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground text-left space-y-1 font-mono">
            <div className="flex justify-between">
              <span>ACCOUNT STATUS:</span>
              <span className="text-amber-500 font-bold">PENDING APPROVAL</span>
            </div>
            {email && (
              <div className="flex justify-between">
                <span>VERIFIED EMAIL:</span>
                <span className="text-foreground truncate max-w-[170px]">{email}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>SITE JURISDICTION:</span>
              <span className="text-foreground">Primary Sector Hub</span>
            </div>
          </div>

          <Button
            onClick={handleCheckStatus}
            disabled={isChecking}
            className="w-full h-11 text-xs font-semibold gap-2"
          >
            <RefreshCw className={isChecking ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            Check Approval Status / Log In
          </Button>

          <div className="text-xs text-muted-foreground">
            Questions? Contact your commanding officer or surveillance dispatcher.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function MobilePendingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <MobilePendingContent />
    </Suspense>
  );
}
