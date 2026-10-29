'use client';

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '@/services/dashboard.service';
import { Bell, X, ShieldAlert, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function SinceYouLeftBanner() {
  const [dismissed, setDismissed] = useState<boolean>(true);

  useEffect(() => {
    const isDismissed = sessionStorage.getItem('sentinel_since_digest_dismissed');
    if (!isDismissed) {
      setDismissed(false);
    }
  }, []);

  const { data: digest } = useQuery({
    queryKey: ['dashboard', 'since-digest'],
    queryFn: () => dashboardService.getSinceDigest(),
    staleTime: 60_000,
  });

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('sentinel_since_digest_dismissed', 'true');
  };

  if (dismissed || !digest || !digest.hasUpdates) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="relative flex items-center justify-between gap-3 px-4 py-2 text-xs border rounded-lg bg-card/80 backdrop-blur-md border-border/80 text-card-foreground shadow-sm animate-in fade-in slide-in-from-top-1 duration-200"
    >
      <div className="flex items-center gap-2.5 overflow-hidden">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Sparkles className="h-3.5 w-3.5" />
        </div>
        <div className="flex items-center gap-2 truncate">
          <span className="font-semibold text-foreground shrink-0">Since your last session:</span>
          <span className="text-muted-foreground truncate">{digest.summaryText}</span>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
        onClick={handleDismiss}
        aria-label="Dismiss digest banner"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
