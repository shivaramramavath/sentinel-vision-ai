'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '@/services/dashboard.service';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Lightbulb,
  X,
  ArrowRight,
  HelpCircle,
  VideoOff,
  Search,
  Camera,
  AlertCircle,
  Compass,
  CheckCircle2,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { DashboardSuggestion } from '@sentinel/shared-types';

export function SuggestedActionsWidget() {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const { data: suggestions = [], isLoading } = useQuery<DashboardSuggestion[]>({
    queryKey: ['dashboard', 'suggestions'],
    queryFn: () => dashboardService.getSuggestions(),
    staleTime: 30_000,
  });

  const handleDismiss = async (id: string) => {
    setDismissedIds((prev) => new Set(prev).add(id));
    await dashboardService.dismissSuggestion(id);
  };

  const visibleSuggestions = suggestions.filter((s) => !dismissedIds.has(s.id));

  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case 'COVERAGE_GAP':
        return <VideoOff className="h-4 w-4 text-amber-500" />;
      case 'UNSEARCHED_CAMERAS':
        return <Compass className="h-4 w-4 text-blue-500" />;
      case 'LOW_READINESS':
        return <Camera className="h-4 w-4 text-purple-500" />;
      case 'SEARCH_EMPTY':
        return <Search className="h-4 w-4 text-foreground" />;
      default:
        return <Lightbulb className="h-4 w-4 text-foreground" />;
    }
  };

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="p-3.5 pb-2 border-b bg-card flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-sm font-semibold tracking-tight flex items-center gap-1.5">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            <span>Suggested Actions &amp; Gaps</span>
          </CardTitle>
          <p className="text-[11px] text-muted-foreground">
            Rule-based intelligence recommendations
          </p>
        </div>
        <Badge variant="outline" className="font-mono text-[10px]">
          {visibleSuggestions.length} active
        </Badge>
      </CardHeader>

      <CardContent className="p-0 flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        ) : visibleSuggestions.length === 0 ? (
          <div className="p-8 text-center flex flex-col items-center justify-center text-muted-foreground space-y-2">
            <CheckCircle2 className="h-8 w-8 text-muted-foreground/60" />
            <p className="text-xs font-medium text-foreground">No gaps detected</p>
            <p className="text-[11px]">All active cases have optimal coverage and indexing.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {visibleSuggestions.map((item) => (
              <div key={item.id} className="p-3 hover:bg-muted/30 transition-colors space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5 shrink-0">{getSuggestionIcon(item.type)}</div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-xs text-foreground">{item.title}</span>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {item.caseNumber}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{item.evidence}</p>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 text-muted-foreground hover:text-foreground shrink-0"
                    onClick={() => handleDismiss(item.id)}
                    aria-label="Dismiss recommendation"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>

                {/* Explainability Callout */}
                <TooltipProvider delayDuration={100}>
                  <div className="flex items-center justify-between pt-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground cursor-help font-mono">
                          <HelpCircle className="h-3 w-3" />
                          <span>Why this is suggested</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs text-xs">
                        {item.reason}
                      </TooltipContent>
                    </Tooltip>

                    <Link href={item.actionUrl}>
                      <Button size="sm" variant="outline" className="h-6 text-[11px] px-2.5 gap-1 font-medium">
                        <span>{item.actionLabel}</span>
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    </Link>
                  </div>
                </TooltipProvider>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
