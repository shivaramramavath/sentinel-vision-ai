'use client';

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import {
  SinceYouLeftBanner,
  DashboardKpiStrip,
  SituationRoom,
  ActionQueueWidget,
  SuggestedActionsWidget,
  LiveSearchesWidget,
  ActivityFeedWidget,
  DashboardInsightsWidget,
  TeamOnCallWidget,
} from '@/components/features/dashboard';
import {
  Eye,
  UserPlus,
  SlidersHorizontal,
  ChevronDown,
  Building2,
  Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const site = searchParams.get('site') || 'all';
  const range = searchParams.get('range') || '24h';

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === 'all' && key === 'site') {
        params.delete('site');
      } else {
        params.set(key, value);
      }
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  return (
    <div className="space-y-4 pb-8">
      {/* 1. Header (max 64px tall, clean and compact) */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-3 pt-1">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Command Center
          </h1>
          <p className="text-xs text-muted-foreground">
            Operational situation room &amp; real-time surveillance intelligence
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Global Site Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-mono">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="capitalize">{site === 'all' ? 'All Sites' : site.replace('-', ' ')}</span>
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="text-xs font-mono">
              <DropdownMenuItem onClick={() => updateParam('site', 'all')}>
                All Sites
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => updateParam('site', 'metro-central')}>
                Metro Central Terminal
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => updateParam('site', 'north-hub')}>
                North Transit Hub
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => updateParam('site', 'east-station')}>
                East Regional Station
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Time Range Chips */}
          <div className="flex items-center rounded-lg border bg-muted/30 p-0.5 text-xs font-mono">
            {['24h', '7d', '30d'].map((r) => (
              <button
                key={r}
                onClick={() => updateParam('range', r)}
                className={cn(
                  'px-2.5 py-1 rounded-md text-[11px] transition-colors',
                  range === r
                    ? 'bg-background text-foreground font-semibold shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {r}
              </button>
            ))}
          </div>

          {/* Action Buttons */}
          <Link href="/search">
            <Button size="sm" className="h-8 gap-1.5 text-xs font-medium">
              <Eye className="h-3.5 w-3.5" />
              <span>Start AI search</span>
            </Button>
          </Link>

          <Link href="/cases?action=new">
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-medium">
              <UserPlus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Register missing person</span>
              <span className="sm:hidden">Register</span>
            </Button>
          </Link>
        </div>
      </header>

      {/* 2. Since You Left Banner */}
      <SinceYouLeftBanner />

      {/* 3. Compact KPI Strip (5 cards) */}
      <DashboardKpiStrip site={site} range={range} />

      {/* 4. Hero: Situation Room */}
      <SituationRoom />

      {/* 5. Row A (7 / 5 cols): Action Queue + Suggested Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 h-[360px]">
          <ActionQueueWidget />
        </div>
        <div className="lg:col-span-5 h-[360px]">
          <SuggestedActionsWidget />
        </div>
      </div>

      {/* 6. Row B (7 / 5 cols): Live Searches + Recent Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 h-[350px]">
          <LiveSearchesWidget />
        </div>
        <div className="lg:col-span-5 h-[350px]">
          <ActivityFeedWidget />
        </div>
      </div>

      {/* 7. Row C (8 / 4 cols): Insights & Calibration + Team On-Call */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 h-[340px]">
          <DashboardInsightsWidget />
        </div>
        <div className="lg:col-span-4 h-[340px]">
          <TeamOnCallWidget />
        </div>
      </div>
    </div>
  );
}
