'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Layers, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MapLegendProps {
  className?: string;
  defaultExpanded?: boolean;
  showJourneyItems?: boolean;
  showDispersionItems?: boolean;
}

/**
 * Themed Map Legend for Sentinel Vision AI.
 * Displays strict semantic color mappings:
 * - Green = Online sensor node
 * - Red = Offline sensor node
 * - Amber = Degraded sensor / possible unverified candidate
 * - Blue = Active tracking thread / verified trajectory
 * Explicitly disclaims identity confirmation.
 */
export function MapLegend({
  className,
  defaultExpanded = true,
  showJourneyItems = true,
  showDispersionItems = true,
}: MapLegendProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <Card
      className={cn(
        'bg-card/95 backdrop-blur-sm border shadow-lg transition-all duration-200 text-xs overflow-hidden',
        className,
      )}
    >
      {/* Header with collapse button */}
      <div
        className="flex items-center justify-between p-2.5 cursor-pointer border-b bg-muted/30 select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-1.5 font-semibold text-foreground text-[11px] uppercase font-mono tracking-wider">
          <Layers className="h-3.5 w-3.5 text-muted-foreground" />
          Map Semantics & Legend
        </div>
        <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground p-0">
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {expanded && (
        <div className="p-3 space-y-3">
          {/* Edge Camera Status */}
          <div className="space-y-1.5">
            <span className="text-[10px] uppercase font-mono font-bold text-muted-foreground block">
              Sensor Nodes
            </span>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-sm" />
                <span>Online (Ingesting)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-rose-500 shadow-sm" />
                <span>Offline Sensor</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-500 shadow-sm" />
                <span>Degraded Stream</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blue-500 shadow-sm animate-pulse" />
                <span>Active Track</span>
              </div>
            </div>
          </div>

          {/* Journey Trajectory Hops */}
          {showJourneyItems && (
            <div className="space-y-1.5 border-t pt-2">
              <span className="text-[10px] uppercase font-mono font-bold text-muted-foreground block">
                Trajectory Hops
              </span>
              <div className="space-y-1 text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="h-1 w-5 rounded bg-blue-500" />
                  <span>Human-Verified Hop (Solid)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-1 w-5 border-t-2 border-dashed border-amber-500" />
                  <span>Possible Match Hop (Dashed Amber)</span>
                </div>
              </div>
            </div>
          )}

          {/* Dispersion Area */}
          {showDispersionItems && (
            <div className="space-y-1.5 border-t pt-2">
              <span className="text-[10px] uppercase font-mono font-bold text-muted-foreground block">
                Spatial Boundaries
              </span>
              <div className="space-y-1 text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full border border-dashed border-amber-500 bg-amber-500/20" />
                  <span>Reachable Area (1.4 m/s walking)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-sm border border-blue-500/50 bg-blue-500/15" />
                  <span>Camera FOV Optical Cone</span>
                </div>
              </div>
            </div>
          )}

          {/* Compliance Disclaimer */}
          <div className="border-t pt-2 text-[9px] text-muted-foreground leading-snug italic flex items-start gap-1">
            <Info className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
            <span>
              Colors represent operational telemetry & algorithmic similarity. Never used as sole proof of identity.
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}
