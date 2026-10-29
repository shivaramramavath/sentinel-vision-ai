'use client';

import React from 'react';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '@/services/dashboard.service';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users,
  Radio,
  Phone,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import type { TeamOnCallStatus } from '@sentinel/shared-types';

export function TeamOnCallWidget() {
  const { data: teamStatus, isLoading } = useQuery<TeamOnCallStatus>({
    queryKey: ['dashboard', 'team-workload'],
    queryFn: () => dashboardService.getTeamWorkload(),
    staleTime: 30_000,
  });

  if (isLoading || !teamStatus) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="p-3.5 pb-2 border-b">
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent className="p-3 space-y-3">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  const { currentOnCallUser, reviewers, workloadImbalanceWarning } = teamStatus;

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="p-3.5 pb-2 border-b bg-card flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-sm font-semibold tracking-tight flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            <span>Team &amp; On-Call</span>
          </CardTitle>
          <p className="text-[11px] text-muted-foreground">
            Active verification shift and queue load
          </p>
        </div>
        <Badge variant="outline" className="font-mono text-[10px] text-emerald-500 border-emerald-500/40">
          Shift Active
        </Badge>
      </CardHeader>

      <CardContent className="p-3 space-y-3 flex-1 overflow-y-auto">
        {/* Current On-Call Commander */}
        <div className="p-2.5 rounded-lg border bg-muted/20 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative h-10 w-10 rounded-full border bg-muted overflow-hidden shrink-0">
              <Image
                src={currentOnCallUser.avatarUrl}
                alt=""
                width={40}
                height={40}
                className="object-cover h-full w-full"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-xs text-foreground truncate">
                  {currentOnCallUser.name}
                </span>
                <Badge variant="secondary" className="text-[9px] font-mono px-1 py-0 h-3.5">
                  Lead
                </Badge>
              </div>
              <p className="text-[10px] font-mono text-muted-foreground">
                On-call until {new Date(currentOnCallUser.shiftEndAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              title="Radio Dispatch"
            >
              <Radio className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              title="Secure Call"
            >
              <Phone className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Workload Imbalance Warning Alert */}
        {workloadImbalanceWarning && (
          <div className="p-2 rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-500 text-[11px] flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{workloadImbalanceWarning}</span>
          </div>
        )}

        {/* Active Reviewers Queue Load */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Reviewer Load Distribution
          </span>

          <div className="divide-y divide-border/60 border rounded-lg overflow-hidden">
            {reviewers.map((rev) => (
              <div key={rev.userId} className="p-2 flex items-center justify-between text-xs bg-card hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="relative h-6 w-6 rounded-full overflow-hidden bg-muted shrink-0">
                    <Image
                      src={rev.avatarUrl}
                      alt=""
                      width={24}
                      height={24}
                      className="object-cover h-full w-full"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                  <div className="truncate">
                    <span className="font-medium text-foreground text-[11px]">{rev.name}</span>
                    <span className="text-[10px] text-muted-foreground ml-1.5 font-mono">
                      {rev.avgReviewSec}s / rev
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0 h-4">
                    {rev.pendingReviewsCount} in queue
                  </Badge>
                  {rev.isOnline && (
                    <span className="h-2 w-2 rounded-full bg-emerald-500" title="Online" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
