'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '@/services/dashboard.service';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Clock,
  TrendingDown,
  TrendingUp,
  ArrowUpRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DashboardSummary } from '@sentinel/shared-types';

export interface DashboardKpiStripProps {
  site?: string;
  range?: string;
  className?: string;
  isOverlay?: boolean;
  kpis?: Array<{ label: string; value: string; change: string; status?: string }>;
}

export function DashboardKpiStrip({ site, range = '24h', className }: DashboardKpiStripProps) {
  const { data: summary, isLoading } = useQuery<DashboardSummary>({
    queryKey: ['dashboard', 'summary', site, range],
    queryFn: () => dashboardService.getSummary(site, range),
    staleTime: 30_000,
  });

  if (isLoading || !summary) {
    return (
      <div className={cn('grid grid-cols-2 md:grid-cols-5 gap-3', className)}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="p-3.5 border rounded-xl bg-card space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div
        role="region"
        aria-label="Command Center KPIs"
        className={cn('grid grid-cols-2 md:grid-cols-5 gap-3', className)}
      >
        {/* Card 1: Active Missing Persons */}
        <Link
          href="/cases?status=active"
          className="group block p-3.5 border rounded-xl bg-card hover:border-foreground/40 transition-colors shadow-xs"
        >
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span className="truncate">Active Cases</span>
            <ArrowUpRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-2xl font-bold font-mono tracking-tight text-foreground">
              {summary.activeCasesCount}
            </span>
            {summary.criticalCasesCount > 0 && (
              <Badge variant="outline" className="border-amber-500/50 text-amber-500 font-mono text-[10px] px-1.5 py-0 h-4">
                {summary.criticalCasesCount} critical
              </Badge>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1 truncate">
            Under active search
          </div>
        </Link>

        {/* Card 2: Awaiting Review */}
        <Link
          href="/review?status=pending"
          className="group block p-3.5 border rounded-xl bg-card hover:border-foreground/40 transition-colors shadow-xs"
        >
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span className="truncate">Awaiting Review</span>
            <ArrowUpRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-2xl font-bold font-mono tracking-tight text-foreground">
              {summary.awaitingReviewCount}
            </span>
            {summary.slaBreachCount > 0 && (
              <Badge variant="destructive" className="font-mono text-[10px] px-1.5 py-0 h-4 animate-pulse">
                {summary.slaBreachCount} SLA breach
              </Badge>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1 truncate font-mono">
            <Clock className="h-3 w-3 shrink-0" />
            <span>Oldest: {summary.oldestReviewWaitMinutes}m</span>
          </div>
        </Link>

        {/* Card 3: Searches Running */}
        <Link
          href="/search"
          className="group block p-3.5 border rounded-xl bg-card hover:border-foreground/40 transition-colors shadow-xs"
        >
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span className="truncate">Searches Running</span>
            <ArrowUpRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-2xl font-bold font-mono tracking-tight text-foreground">
              {summary.searchesRunningCount}
            </span>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
          </div>
          <div className="text-[11px] text-muted-foreground mt-1 truncate font-mono">
            {summary.searchesStageSummary}
          </div>
        </Link>

        {/* Card 4: Same-Person Decisions (last 7 d) */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href="/review?status=decided"
              className="group block p-3.5 border rounded-xl bg-card hover:border-foreground/40 transition-colors shadow-xs"
            >
              <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
                <span className="truncate">Same-Person (7d)</span>
                <ArrowUpRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="flex items-baseline gap-2 mt-1.5">
                <span className="text-2xl font-bold font-mono tracking-tight text-foreground">
                  {summary.samePersonDecisions7d}
                </span>
                <span className="text-xs text-muted-foreground font-mono">verified</span>
              </div>
              <div className="text-[11px] text-muted-foreground mt-1 truncate">
                {summary.rejectedDecisions7d} not same person
              </div>
            </Link>
          </TooltipTrigger>
          <TooltipContent className="text-xs font-mono">
            {summary.samePersonDecisions7d} verified same person · {summary.rejectedDecisions7d} rejected
          </TooltipContent>
        </Tooltip>

        {/* Card 5: Median Turnaround to First Review */}
        <div className="p-3.5 border rounded-xl bg-card shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span className="truncate">Turnaround Time</span>
            <span className="flex items-center text-[10px] font-mono text-emerald-500">
              {summary.turnaroundTrendPct < 0 ? (
                <>
                  <TrendingDown className="h-3 w-3 mr-0.5" />
                  {Math.abs(summary.turnaroundTrendPct)}% faster
                </>
              ) : (
                <>
                  <TrendingUp className="h-3 w-3 mr-0.5" />
                  +{summary.turnaroundTrendPct}%
                </>
              )}
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-2xl font-bold font-mono tracking-tight text-foreground">
              {summary.medianTimeToFirstReviewMinutes}m
            </span>
            <span className="text-xs text-muted-foreground">median</span>
          </div>
          <div className="text-[11px] text-muted-foreground mt-1 truncate font-mono">
            Target: &lt; {summary.targetReviewMinutes}m
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
