'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '@/services/dashboard.service';
import { SentinelMap, CameraLayer } from '@/components/features/map';
import { LastKnownLayer } from '@/components/features/map/LastKnownLayer';
import { JourneyLayer } from '@/components/features/map/JourneyLayer';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import {
  Clock,
  Eye,
  Search,
  Maximize2,
  ExternalLink,
  Layers,
  Video,
  ShieldAlert,
  AlertTriangle,
  MapPin,
  CheckCircle2,
  SlidersHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PriorityCaseSummary } from '@sentinel/shared-types';
import type { Camera, Journey } from '@/types';
import { useCameras } from '@/hooks/use-cameras';

export interface SituationRoomProps {
  className?: string;
}

export function SituationRoom({ className }: SituationRoomProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const caseParam = searchParams.get('case');

  const { data: cases = [], isLoading } = useQuery<PriorityCaseSummary[]>({
    queryKey: ['dashboard', 'priority-cases'],
    queryFn: () => dashboardService.getPriorityCases(),
    staleTime: 30_000,
  });

  // Selected case
  const selectedCase = useMemo(() => {
    if (!cases.length) return null;
    if (caseParam) {
      const found = cases.find((c) => c.id === caseParam || c.caseNumber === caseParam);
      if (found) return found;
    }
    return cases[0];
  }, [cases, caseParam]);

  // Handle case selection and URL update
  const handleSelectCase = useCallback(
    (caseItem: PriorityCaseSummary) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('case', caseItem.id);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  // Live ticking missing timer
  const [now, setNow] = useState<number>(Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 30_000); // 30 sec tick
    return () => clearInterval(timer);
  }, []);

  // Layer toggles
  const [showReachableArea, setShowReachableArea] = useState<boolean>(true);
  const [showJourneyHops, setShowJourneyHops] = useState<boolean>(true);
  const [showSuggestedCameras, setShowSuggestedCameras] = useState<boolean>(true);
  const [showCamerasInArea, setShowCamerasInArea] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Compute live missing duration string
  const formatMissingDuration = (lastSeenAt: string) => {
    const diffMs = Math.max(0, now - new Date(lastSeenAt).getTime());
    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours === 0) return `${minutes}m`;
    return `${hours}h ${minutes}m`;
  };

  // Convert selectedCase journey hops to Journey object for JourneyLayer
  const syntheticJourney = useMemo<Journey | null>(() => {
    if (!selectedCase || !selectedCase.journeyHops?.length) return null;
    return {
      id: `journey-${selectedCase.id}`,
      caseId: selectedCase.id,
      personName: selectedCase.personName,
      totalDistanceMeters: selectedCase.reachableAreaMeters,
      durationMinutes: Math.round((selectedCase.missingHours || 1) * 60),
      firstSeenAt: selectedCase.journeyHops[0].timestamp,
      lastSeenAt: selectedCase.journeyHops[selectedCase.journeyHops.length - 1].timestamp,
      status: 'active',
      cameraSequence: selectedCase.journeyHops.map((hop, idx) => ({
        sightingId: hop.id,
        cameraId: hop.cameraCode,
        cameraName: `Camera ${hop.cameraCode}`,
        zone: hop.cameraCode,
        timestamp: hop.timestamp,
        confidenceBand: hop.status === 'same_person' ? 'high' : 'medium',
        coords: [hop.coords[1], hop.coords[0]] as [number, number],
        dwellTimeSeconds: 45,
        status: hop.status === 'same_person' ? 'confirmed' : 'possible',
        verified: hop.status === 'same_person',
        appearanceSimilarity: hop.status === 'same_person' ? 0.92 : 0.68,
      })),
    };
  }, [selectedCase]);

  const { data: rawCameras = [] } = useCameras();

  // Suggested cameras converted for display
  const camerasForLayer = useMemo<Camera[]>(() => {
    if (!showCamerasInArea) return [];
    return rawCameras;
  }, [showCamerasInArea, rawCameras]);

  if (isLoading) {
    return (
      <div className="h-[460px] w-full border rounded-xl bg-card p-4 flex gap-4">
        <div className="w-[340px] space-y-3">
          <Skeleton className="h-6 w-32" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
        <Skeleton className="flex-1 h-full rounded-lg" />
      </div>
    );
  }

  if (!selectedCase) {
    return null;
  }

  return (
    <div
      className={cn(
        'w-full border rounded-xl overflow-hidden bg-card text-card-foreground shadow-sm transition-all',
        isFullscreen ? 'fixed inset-0 z-50 rounded-none h-screen' : 'h-[clamp(380px,46vh,560px)]',
        className,
      )}
    >
      <div className="flex h-full flex-col md:flex-row">
        {/* ================= LEFT RAIL: PRIORITY CASES (340px) ================= */}
        <aside className="w-full md:w-[340px] shrink-0 border-r flex flex-col bg-muted/10 h-full overflow-hidden">
          <div className="p-3 border-b flex items-center justify-between bg-card/60 backdrop-blur-xs">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
                Priority Cases
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Top active investigations by urgency score
              </p>
            </div>
            <Badge variant="outline" className="font-mono text-[10px] h-5">
              {cases.length} cases
            </Badge>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-border/60">
            {cases.map((c) => {
              const isSelected = selectedCase.id === c.id;
              const missingStr = formatMissingDuration(c.lastSeenAt);

              return (
                <div
                  key={c.id}
                  onClick={() => handleSelectCase(c)}
                  className={cn(
                    'p-3 cursor-pointer transition-all relative flex flex-col gap-2 hover:bg-muted/40',
                    isSelected && 'bg-accent/40 border-l-2 border-l-primary shadow-2xs',
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    {/* Person Avatar with neutral fallback */}
                    <div className="relative h-12 w-12 shrink-0 rounded-lg overflow-hidden border bg-muted">
                      <Image
                        src={c.avatarUrl}
                        alt=""
                        width={48}
                        height={48}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold text-xs text-foreground truncate">
                          {c.personName}
                        </span>
                        <Badge
                          variant={c.priority === 'critical' ? 'destructive' : 'outline'}
                          className="font-mono text-[9px] uppercase px-1 py-0 h-4 shrink-0"
                        >
                          {c.priority}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground mt-0.5">
                        <span className="truncate">{c.caseNumber}</span>
                        {c.isMinor && (
                          <Badge variant="outline" className="border-amber-500/40 text-amber-500 text-[9px] px-1 py-0 h-3.5">
                            Minor
                          </Badge>
                        )}
                      </div>

                      {/* Ticking Missing Timer */}
                      <div className="flex items-center gap-1 text-[11px] font-mono text-foreground font-medium mt-1">
                        <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span>Missing {missingStr}</span>
                      </div>
                    </div>
                  </div>

                  {/* Readiness & Live Search Progress */}
                  <div className="space-y-1.5 pt-1 text-[11px]">
                    <div className="flex items-center justify-between text-muted-foreground font-mono text-[10px]">
                      <span>Readiness: {c.readinessScore}%</span>
                      <span>
                        {c.searchProgressPct > 0 ? `Search: ${c.searchProgressPct}%` : 'No active search'}
                      </span>
                    </div>
                    <Progress value={c.readinessScore} className="h-1" />
                  </div>

                  {/* Quick Links */}
                  <div className="flex items-center justify-between pt-1 text-[11px]">
                    <Link
                      href={`/cameras?case=${c.id}&layers=case`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 underline-offset-4 hover:underline"
                    >
                      <Video className="h-3 w-3" />
                      <span>Cameras near ({c.nearCamerasCount})</span>
                    </Link>

                    <Link
                      href={`/cases/${c.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
                    >
                      <span>Open case</span>
                      <ExternalLink className="h-2.5 w-2.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* ================= RIGHT MAP PANE (flex-1) ================= */}
        <section
          aria-label={`Situation Map for ${selectedCase.personName}`}
          className="flex-1 relative h-full w-full overflow-hidden bg-background"
        >
          <SentinelMap
            center={selectedCase.lastKnownCoords}
            zoom={15}
            className="h-full w-full"
          >
            {/* Reachable Area Circle Layer */}
            {showReachableArea && (
              <LastKnownLayer
                center={selectedCase.lastKnownCoords}
                lastSeenTimestamp={selectedCase.lastSeenAt}
                locationName={selectedCase.lastSeenLocation}
                maxRadiusMeters={selectedCase.reachableAreaMeters}
              />
            )}

            {/* Journey Hops Layer for selected case */}
            {showJourneyHops && syntheticJourney && (
              <JourneyLayer journey={syntheticJourney} showPopups={true} />
            )}

            {/* Camera Layer inside area */}
            {showCamerasInArea && <CameraLayer cameras={camerasForLayer} />}
          </SentinelMap>

          {/* Top-Right Glass Layer Controls */}
          <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 bg-background/85 backdrop-blur-md border-border/80 text-xs shadow-xs"
                >
                  <Layers className="h-3.5 w-3.5" />
                  <span>Layers</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 text-xs">
                <DropdownMenuLabel className="font-mono text-[10px] uppercase">
                  Map Layers
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={showReachableArea}
                  onCheckedChange={setShowReachableArea}
                >
                  Reachable Area Buffer
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={showJourneyHops}
                  onCheckedChange={setShowJourneyHops}
                >
                  Journey Hops & Trajectory
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={showSuggestedCameras}
                  onCheckedChange={setShowSuggestedCameras}
                >
                  Suggested Unsearched Cameras
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={showCamerasInArea}
                  onCheckedChange={setShowCamerasInArea}
                >
                  Show All Cameras in Area
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 bg-background/85 backdrop-blur-md border-border/80 shadow-xs"
              onClick={() => setIsFullscreen(!isFullscreen)}
              aria-label="Toggle Fullscreen"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Bottom-Left Floating Context Pill */}
          <div className="absolute bottom-3 left-3 z-20 pointer-events-none">
            <div className="pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/90 backdrop-blur-md border border-border/80 shadow-md text-xs font-mono">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="font-semibold text-foreground">{selectedCase.personName}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">{selectedCase.lastSeenLocation}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">
                {selectedCase.journeyHops?.length || 0} hops recorded
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
