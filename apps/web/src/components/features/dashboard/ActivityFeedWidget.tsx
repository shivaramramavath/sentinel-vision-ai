'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '@/services/dashboard.service';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Activity,
  CheckCircle2,
  Search,
  UserPlus,
  ShieldAlert,
  ArrowRight,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ActivityFeedItem } from '@sentinel/shared-types';

export function ActivityFeedWidget() {
  const [filter, setFilter] = useState<string>('all');

  const { data: activities = [], isLoading } = useQuery<ActivityFeedItem[]>({
    queryKey: ['dashboard', 'activity'],
    queryFn: () => dashboardService.getActivity(),
    staleTime: 15_000,
  });

  const filteredItems = useMemo(() => {
    if (filter === 'all') return activities;
    if (filter === 'detections') return activities.filter((a) => a.type === 'candidate_found');
    if (filter === 'searches') return activities.filter((a) => a.type === 'search_completed');
    if (filter === 'decisions') return activities.filter((a) => a.type === 'decision_made');
    if (filter === 'cases') return activities.filter((a) => a.type === 'case_updated' || a.type === 'status_changed');
    return activities;
  }, [activities, filter]);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'candidate_found':
        return <Activity className="h-3.5 w-3.5 text-blue-500" />;
      case 'decision_made':
        return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
      case 'search_completed':
        return <Search className="h-3.5 w-3.5 text-purple-500" />;
      case 'case_updated':
      case 'status_changed':
        return <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />;
      default:
        return <Activity className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="p-3.5 pb-2 border-b bg-card">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold tracking-tight flex items-center gap-1.5">
              <Activity className="h-4 w-4" />
              <span>Multi-Case Activity Feed</span>
            </CardTitle>
            <p className="text-[11px] text-muted-foreground">
              Audit log of detections, reviews, and search milestones
            </p>
          </div>
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-1.5 pt-2 overflow-x-auto no-scrollbar font-mono text-[11px]">
          {['all', 'detections', 'searches', 'decisions', 'cases'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-2 py-0.5 rounded-full border transition-colors capitalize text-[10px]',
                filter === f
                  ? 'bg-primary text-primary-foreground border-primary font-semibold'
                  : 'bg-muted/30 text-muted-foreground border-border hover:bg-muted/60',
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="p-0 flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            No recent activity matches the selected filter.
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {filteredItems.map((act) => (
              <div key={act.id} className="p-3 hover:bg-muted/30 transition-colors flex items-start gap-2.5">
                <div className="mt-0.5 p-1 rounded-full bg-muted/60 shrink-0">
                  {getActivityIcon(act.type)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold text-xs text-foreground truncate">
                      {act.title}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                      {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                    {act.details}
                  </p>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] font-mono text-muted-foreground">
                      By {act.actor}
                    </span>

                    {act.targetUrl && (
                      <Link
                        href={act.targetUrl}
                        className="text-[11px] font-medium text-primary hover:underline flex items-center gap-0.5"
                      >
                        <span>View</span>
                        <ArrowRight className="h-2.5 w-2.5" />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
