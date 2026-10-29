'use client';

import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { MapPin } from 'lucide-react';

export interface DashboardHeroMapSkeletonProps {
  collapsed?: boolean;
  className?: string;
}

export function DashboardHeroMapSkeleton({ collapsed = false, className }: DashboardHeroMapSkeletonProps) {
  return (
    <div
      aria-label="Loading surveillance map..."
      role="status"
      className={cn(
        'relative w-full rounded-xl border border-border bg-muted/20 overflow-hidden flex flex-col justify-between p-4',
        collapsed ? 'h-[200px]' : 'h-[clamp(420px,55vh,640px)]',
        className,
      )}
    >
      {/* Top overlay placeholders */}
      <div className="flex items-center justify-between gap-4 w-full">
        {/* KPI strip placeholder */}
        <div className="hidden md:flex items-center gap-2 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-[130px] rounded-lg shrink-0" />
          ))}
        </div>
        {/* Filter popover & controls placeholder */}
        <div className="flex items-center gap-2 ml-auto">
          <Skeleton className="h-8 w-24 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
      </div>

      {/* Center radar icon pulse */}
      <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
        <MapPin className="h-8 w-8 animate-pulse text-muted-foreground/60" />
        <span className="text-xs font-mono text-muted-foreground/80">
          Initializing Spatial Surveillance Engine...
        </span>
      </div>

      {/* Bottom overlay placeholder */}
      <div className="flex items-end justify-between w-full">
        <Skeleton className="h-16 w-64 rounded-lg" />
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>
    </div>
  );
}
