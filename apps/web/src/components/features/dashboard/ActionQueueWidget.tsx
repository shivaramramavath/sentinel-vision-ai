'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '@/services/dashboard.service';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileEdit,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  HelpCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ActionQueueItem } from '@sentinel/shared-types';

export function ActionQueueWidget() {
  const [activeTab, setActiveTab] = useState<string>('all');
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(timer);
  }, []);

  const { data: queue = [], isLoading, refetch } = useQuery<ActionQueueItem[]>({
    queryKey: ['dashboard', 'action-queue'],
    queryFn: () => dashboardService.getActionQueue(),
    staleTime: 15_000,
  });

  // Filter items by tab
  const filteredItems = useMemo(() => {
    if (activeTab === 'all') return queue;
    if (activeTab === 'reviews') return queue.filter((i) => i.type === 'review' || i.type === 'sla_breach');
    if (activeTab === 'escalations') return queue.filter((i) => i.type === 'sla_breach' || i.type === 'stale_case');
    if (activeTab === 'approvals') return queue.filter((i) => i.type === 'report_approval' || i.type === 'mobile_approval');
    if (activeTab === 'drafts') return queue.filter((i) => i.type === 'draft_case');
    return queue;
  }, [queue, activeTab]);

  // Counts for tabs
  const counts = useMemo(() => {
    return {
      all: queue.length,
      reviews: queue.filter((i) => i.type === 'review' || i.type === 'sla_breach').length,
      escalations: queue.filter((i) => i.type === 'sla_breach' || i.type === 'stale_case').length,
      approvals: queue.filter((i) => i.type === 'report_approval' || i.type === 'mobile_approval').length,
      drafts: queue.filter((i) => i.type === 'draft_case').length,
    };
  }, [queue]);

  const handleNeedMoreEvidence = (itemId: string) => {
    // Optimistic notice or call
    refetch();
  };

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="p-3.5 pb-2 border-b bg-card">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold tracking-tight">Action Queue</CardTitle>
            <p className="text-[11px] text-muted-foreground">
              Urgent tasks requiring operator decisions and verification
            </p>
          </div>
          <Badge variant="outline" className="font-mono text-[10px]">
            {counts.all} pending
          </Badge>
        </div>

        {/* Tab Filter */}
        <div className="pt-2">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="h-7 w-full justify-start bg-muted/40 p-0.5 text-xs font-mono">
              <TabsTrigger value="all" className="h-6 text-[11px] px-2">
                All ({counts.all})
              </TabsTrigger>
              <TabsTrigger value="reviews" className="h-6 text-[11px] px-2">
                Reviews ({counts.reviews})
              </TabsTrigger>
              <TabsTrigger value="escalations" className="h-6 text-[11px] px-2">
                Escalations ({counts.escalations})
              </TabsTrigger>
              <TabsTrigger value="approvals" className="h-6 text-[11px] px-2">
                Approvals ({counts.approvals})
              </TabsTrigger>
              <TabsTrigger value="drafts" className="h-6 text-[11px] px-2">
                Drafts ({counts.drafts})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>

      <CardContent className="p-0 flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-8 text-center flex flex-col items-center justify-center text-muted-foreground space-y-2">
            <CheckCircle2 className="h-8 w-8 text-muted-foreground/60" />
            <p className="text-xs font-medium text-foreground">Action queue clear</p>
            <p className="text-[11px]">All pending reviews and escalations are handled.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {filteredItems.map((item) => {
              const isBreached = item.isBreached || (item.slaMinutesRemaining !== undefined && item.slaMinutesRemaining <= 0);
              const isReview = item.type === 'review' || item.type === 'sla_breach';

              return (
                <div key={item.id} className="p-3 hover:bg-muted/30 transition-colors flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-foreground">{item.title}</span>
                      {item.caseNumber && (
                        <span className="text-[11px] font-mono text-muted-foreground">
                          {item.caseNumber}
                        </span>
                      )}
                    </div>

                    {/* SLA countdown badge */}
                    {item.slaMinutesRemaining !== undefined && (
                      <Badge
                        variant={isBreached ? 'destructive' : 'outline'}
                        className={cn(
                          'font-mono text-[9px] px-1.5 py-0 h-4 shrink-0',
                          !isBreached && item.slaMinutesRemaining < 5 && 'border-amber-500 text-amber-500',
                        )}
                      >
                        <Clock className="h-2.5 w-2.5 mr-1" />
                        {isBreached ? 'SLA BREACH' : `${Math.floor(item.slaMinutesRemaining)}m left`}
                      </Badge>
                    )}
                  </div>

                  {/* Sighting comparison if review item */}
                  {isReview && item.candidateCropUrl && (
                    <div className="flex items-center gap-3 bg-muted/20 p-2 rounded-lg border border-border/40">
                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className="relative h-12 w-12 rounded border bg-muted overflow-hidden">
                          <Image
                            src={item.candidateCropUrl}
                            alt=""
                            width={48}
                            height={48}
                            className="object-cover h-full w-full"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                          <span className="absolute bottom-0 inset-x-0 bg-background/80 text-[8px] text-center font-mono py-0.5">
                            CROP
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground font-mono">vs</span>
                        <div className="relative h-12 w-12 rounded border bg-muted overflow-hidden">
                          <Image
                            src={item.referenceCropUrl || item.candidateCropUrl}
                            alt=""
                            width={48}
                            height={48}
                            className="object-cover h-full w-full"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                          <span className="absolute bottom-0 inset-x-0 bg-background/80 text-[8px] text-center font-mono py-0.5">
                            REF
                          </span>
                        </div>
                      </div>

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-mono">
                          <span className="text-muted-foreground truncate">{item.cameraCode || 'Camera Ingest'}</span>
                          <span className="font-bold text-foreground">
                            {Math.round((item.fusedScore || 0.8) * 100)}% similarity
                          </span>
                        </div>
                        <Progress value={(item.fusedScore || 0.8) * 100} className="h-1.5" />
                        <div className="text-[10px] text-muted-foreground truncate">
                          {item.locationName || 'Metro Network'}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Quick Inline Actions */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] font-mono text-muted-foreground">
                      Created {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>

                    <div className="flex items-center gap-2">
                      {isReview && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[11px] px-2 text-muted-foreground hover:text-foreground"
                          onClick={() => handleNeedMoreEvidence(item.id)}
                        >
                          Need more evidence
                        </Button>
                      )}

                      <Link
                        href={
                          isReview
                            ? `/review?case=${item.caseId || ''}`
                            : item.type === 'draft_case'
                            ? `/cases?draft=${item.id}`
                            : `/alerts`
                        }
                      >
                        <Button size="sm" className="h-6 text-[11px] px-2.5 gap-1 font-medium">
                          <span>
                            {isReview ? 'Review now' : item.type === 'draft_case' ? 'Resume draft' : 'Resolve'}
                          </span>
                          <ArrowRight className="h-3 w-3" />
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
