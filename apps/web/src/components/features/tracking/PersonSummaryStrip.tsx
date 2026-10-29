'use client';

import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DetailedJourney } from '@/types/tracking';
import {
  Sparkles,
  MapPin,
  Clock,
  Footprints,
  ShieldCheck,
  AlertTriangle,
  Search,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PersonSummaryStripProps {
  journey: DetailedJourney;
  onOpenNewSearch: () => void;
  className?: string;
}

export function PersonSummaryStrip({
  journey,
  onOpenNewSearch,
  className,
}: PersonSummaryStripProps) {
  const avatarUrl =
    journey.hops[0]?.thumbnails.referenceUrl ||
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80';

  const lastHop = journey.hops[journey.hops.length - 1];

  return (
    <div
      className={cn(
        'sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card/95 p-3 backdrop-blur-md shadow-xs',
        className,
      )}
    >
      {/* Left: Avatar, Name, Case Info & Verification Note */}
      <div className="flex items-center gap-3 min-w-0">
        <Avatar className="h-10 w-10 rounded-md border shrink-0">
          <AvatarImage src={avatarUrl} alt={journey.personName} />
          <AvatarFallback>{journey.personName.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>

        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-bold text-foreground tracking-tight truncate">
              {journey.personName}
            </h2>
            <Badge variant="outline" className="font-mono text-[10px] font-semibold">
              {journey.caseNumber}
            </Badge>
            <Badge
              variant="outline"
              className="text-[9px] font-mono uppercase border-emerald-500/50 text-emerald-400 bg-emerald-950/20"
            >
              Active Tracking
            </Badge>
            <Badge variant="destructive" className="text-[9px] font-mono uppercase">
              Critical
            </Badge>
          </div>

          <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
            <Info className="h-3 w-3 text-amber-500 shrink-0" />
            <span className="text-amber-500/90 font-medium">
              Possible journey, requires human verification.
            </span>
          </p>
        </div>
      </div>

      {/* Middle: Compact Trajectory Statistics Strip */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs font-mono">
        {/* Hops */}
        <div className="rounded bg-muted/50 px-2 py-1 text-center border border-border/40">
          <span className="text-[9px] text-muted-foreground block uppercase">Hops</span>
          <span className="font-bold text-foreground text-xs">{journey.hopsCount} hops</span>
        </div>

        {/* Distance */}
        <div className="rounded bg-muted/50 px-2 py-1 text-center border border-border/40">
          <span className="text-[9px] text-muted-foreground block uppercase">Walk Distance</span>
          <span className="font-bold text-foreground text-xs">{journey.totalDistanceMeters}m</span>
        </div>

        {/* Elapsed Time */}
        <div className="rounded bg-muted/50 px-2 py-1 text-center border border-border/40">
          <span className="text-[9px] text-muted-foreground block uppercase">Window</span>
          <span className="font-bold text-foreground text-xs">{journey.durationMinutes} min</span>
        </div>

        {/* Confirmed vs Possible */}
        <div className="rounded bg-muted/50 px-2 py-1 text-center border border-border/40">
          <span className="text-[9px] text-muted-foreground block uppercase">Verification</span>
          <span className="font-bold text-xs flex items-center gap-1 text-foreground">
            <span className="text-blue-400">{journey.confirmedCount} conf</span>
            <span>•</span>
            <span className="text-amber-400">{journey.possibleCount} poss</span>
          </span>
        </div>

        {/* Lowest Hop Confidence */}
        <div className="rounded bg-muted/50 px-2 py-1 text-center border border-border/40">
          <span className="text-[9px] text-muted-foreground block uppercase">Lowest Conf.</span>
          <span className="font-bold text-foreground text-xs">
            {Math.round(journey.lowestConfidence * 100)}%
          </span>
        </div>

        {/* Last Seen relative */}
        {lastHop && (
          <div className="rounded bg-muted/50 px-2 py-1 text-center border border-border/40 hidden md:block">
            <span className="text-[9px] text-muted-foreground block uppercase">Last Seen</span>
            <span className="font-bold text-cyan-400 text-xs truncate max-w-[150px] block">
              {new Date(lastHop.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({lastHop.cameraId})
            </span>
          </div>
        )}
      </div>

      {/* Right: Secondary Action Trigger */}
      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          onClick={onOpenNewSearch}
          className="h-8 gap-1.5 text-xs bg-cyan-600 hover:bg-cyan-500 text-white font-medium shadow-xs"
        >
          <Search className="h-3.5 w-3.5" />
          <span>Search footage for this person</span>
        </Button>
      </div>
    </div>
  );
}
