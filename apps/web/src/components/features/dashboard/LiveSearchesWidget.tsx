'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { searchService } from '@/services/search.service';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search,
  Pause,
  Play,
  XCircle,
  ExternalLink,
  Radio,
  Clock,
  Video,
  Eye,
} from 'lucide-react';
import { socket } from '@/lib/socket';
import { cn } from '@/lib/utils';
import type { SearchJob } from '@/types';

export function LiveSearchesWidget() {
  const { data: initialJobs = [], isLoading } = useQuery<SearchJob[]>({
    queryKey: ['dashboard', 'active-searches'],
    queryFn: () => searchService.getActiveJobs(),
    staleTime: 30_000,
  });

  const [jobs, setJobs] = useState<SearchJob[]>([]);

  useEffect(() => {
    if (initialJobs.length) {
      setJobs(initialJobs);
    }
  }, [initialJobs]);

  // Subscribe to real-time search progress websocket event
  useEffect(() => {
    const handleProgress = (data: { searchJobId: string; progressPercent: number; status: string }) => {
      setJobs((prev) =>
        prev.map((job) => {
          if (job.id === data.searchJobId) {
            return {
              ...job,
              progressPercent: data.progressPercent,
              status: data.status as any,
            };
          }
          return job;
        }),
      );
    };

    socket.on('search:progress', handleProgress);
    return () => {
      socket.off('search:progress', handleProgress);
    };
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'searching_reid_index':
      case 'indexing':
        return (
          <Badge variant="outline" className="font-mono text-[9px] border-blue-500/50 text-blue-500">
            Indexing
          </Badge>
        );
      case 'fusing':
      case 'ranking_candidates':
        return (
          <Badge variant="outline" className="font-mono text-[9px] border-purple-500/50 text-purple-500">
            Fusing
          </Badge>
        );
      case 'completed':
        return (
          <Badge variant="outline" className="font-mono text-[9px] border-emerald-500/50 text-emerald-500">
            Completed
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="font-mono text-[9px]">
            Queued
          </Badge>
        );
    }
  };

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="p-3.5 pb-2 border-b bg-card flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-sm font-semibold tracking-tight flex items-center gap-1.5">
            <Search className="h-4 w-4" />
            <span>Live AI Searches</span>
          </CardTitle>
          <p className="text-[11px] text-muted-foreground">
            Distributed multi-camera vector index scanning in real-time
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
          <Badge variant="outline" className="font-mono text-[10px]">
            {jobs.length} active
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-0 flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            No search jobs currently executing.
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {jobs.map((job) => {
              const camerasScanned = Math.round((job.progressPercent / 100) * job.cameraScopeCount);
              const etaSeconds = Math.max(0, Math.round(((100 - job.progressPercent) / 100) * 90));

              return (
                <div key={job.id} className="p-3 hover:bg-muted/30 transition-colors space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-foreground">
                          {job.caseTitle || `Search #${job.id}`}
                        </span>
                        {getStatusBadge(job.status)}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground mt-0.5">
                        <span>Target: Person</span>
                        <span>·</span>
                        <span>{job.timeRangeHours}h window</span>
                      </div>
                    </div>

                    <div className="text-right font-mono text-xs">
                      <span className="font-bold text-foreground">
                        {job.candidatesFound} candidates
                      </span>
                      <div className="text-[10px] text-muted-foreground">
                        {etaSeconds > 0 ? `ETA: ${etaSeconds}s` : 'Finishing'}
                      </div>
                    </div>
                  </div>

                  {/* Progress bar and details */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                      <span>
                        Cameras: {camerasScanned} / {job.cameraScopeCount} scanned
                      </span>
                      <span className="font-bold text-foreground">{job.progressPercent}%</span>
                    </div>
                    <Progress value={job.progressPercent} className="h-1.5" />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] font-mono text-muted-foreground">
                      Started {new Date(job.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                        title="Pause Job"
                      >
                        <Pause className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        title="Cancel Job"
                      >
                        <XCircle className="h-3 w-3" />
                      </Button>
                      <Link href={`/search?job=${job.id}`}>
                        <Button size="sm" variant="outline" className="h-6 text-[11px] px-2 gap-1 font-medium">
                          <span>View results</span>
                          <ExternalLink className="h-2.5 w-2.5" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
