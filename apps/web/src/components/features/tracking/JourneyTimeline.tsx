'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { DetailedJourney, DetailedHopNode } from '@/types/tracking';
import {
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Eye,
  Film,
  Crosshair,
  Footprints,
  Compass,
  ArrowRight,
  Shield,
  Layers,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Search,
  Filter,
  ArrowUpDown,
  Maximize2,
  Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface JourneyTimelineProps {
  journeys: DetailedJourney[];
  selectedJourneyId: string;
  onSelectJourneyId: (journeyId: string) => void;
  selectedHopIndex: number;
  onSelectHopIndex: (index: number) => void;
  hoveredHopIndex: number | null;
  onHoverHopIndex: (index: number | null) => void;
  onConfirmHop: (sightingId: string, notes?: string) => void;
  onRejectHop: (sightingId: string, reason: string) => void;
  onOpenEvidenceModal: (hop: DetailedHopNode) => void;
  onOpenSearchSheet: () => void;
  onFocusMapHop?: (index: number) => void;
  className?: string;
}

export function JourneyTimeline({
  journeys,
  selectedJourneyId,
  onSelectJourneyId,
  selectedHopIndex,
  onSelectHopIndex,
  hoveredHopIndex,
  onHoverHopIndex,
  onConfirmHop,
  onRejectHop,
  onOpenEvidenceModal,
  onOpenSearchSheet,
  onFocusMapHop,
  className,
}: JourneyTimelineProps) {
  const activeJourney = journeys.find((j) => j.journeyId === selectedJourneyId) || journeys[0];

  // Toolbar state
  const [statusFilter, setStatusFilter] = useState<'all' | 'confirmed' | 'possible' | 'rejected'>('all');
  const [density, setDensity] = useState<'detailed' | 'compact'>('detailed');
  const [sortOrder, setSortOrder] = useState<'chronological' | 'confidence'>('chronological');
  const [collapsedHopIds, setCollapsedHopIds] = useState<Record<string, boolean>>({});

  // Reject dialog state
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectSightingId, setRejectSightingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const hopCardRefs = useRef<Record<number, HTMLDivElement | null>>({});

  // Filtered & sorted hops
  const displayHops = useMemo(() => {
    let list = [...activeJourney.hops];

    // Filter
    if (statusFilter !== 'all') {
      list = list.filter((h) => h.status === statusFilter);
    }

    // Sort
    if (sortOrder === 'confidence') {
      list.sort((a, b) => b.scores.fused - a.scores.fused);
    } else {
      list.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }

    return list;
  }, [activeJourney.hops, statusFilter, sortOrder]);

  // Keyboard navigation listener (Arrow Up / Down, Enter, C, R)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        onSelectHopIndex(Math.min(activeJourney.hops.length - 1, selectedHopIndex + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        onSelectHopIndex(Math.max(0, selectedHopIndex - 1));
      } else if (e.key === 'Enter') {
        const current = activeJourney.hops[selectedHopIndex];
        if (current) {
          e.preventDefault();
          onOpenEvidenceModal(current);
        }
      } else if (e.key === 'c' || e.key === 'C') {
        const current = activeJourney.hops[selectedHopIndex];
        if (current && current.status !== 'confirmed') {
          e.preventDefault();
          onConfirmHop(current.sightingId, 'Keyboard confirmed by reviewer');
        }
      } else if (e.key === 'r' || e.key === 'R') {
        const current = activeJourney.hops[selectedHopIndex];
        if (current && current.status !== 'rejected') {
          e.preventDefault();
          setRejectSightingId(current.sightingId);
          setRejectReason('');
          setRejectDialogOpen(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedHopIndex, activeJourney.hops, onSelectHopIndex, onOpenEvidenceModal, onConfirmHop]);

  // Scroll active hop card into view when selected from map
  useEffect(() => {
    const el = hopCardRefs.current[selectedHopIndex];
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedHopIndex]);

  const toggleHopCollapse = (id: string) => {
    setCollapsedHopIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleOpenRejectDialog = (sightingId: string) => {
    setRejectSightingId(sightingId);
    setRejectReason('');
    setRejectDialogOpen(true);
  };

  const handleConfirmReject = () => {
    if (!rejectSightingId || !rejectReason.trim()) return;
    onRejectHop(rejectSightingId, rejectReason.trim());
    setRejectDialogOpen(false);
    setRejectSightingId(null);
  };

  return (
    <Card className={cn('flex flex-col border shadow-sm h-[calc(100vh-14rem)] bg-card', className)}>
      {/* 1. Header & Journey Switcher */}
      <CardHeader className="p-3 border-b bg-muted/20 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Footprints className="h-4 w-4 text-cyan-400" />
            <CardTitle className="text-xs font-bold">
              Chronological Hop Timeline ({activeJourney.hops.length})
            </CardTitle>
          </div>
          <Badge variant="outline" className="font-mono text-[10px]">
            {activeJourney.durationMinutes} min Window
          </Badge>
        </div>

        {/* Alternative Journey Switcher Dropdown with Diff Badges */}
        <Select value={selectedJourneyId} onValueChange={onSelectJourneyId}>
          <SelectTrigger className="w-full h-8 text-xs font-mono bg-background">
            <SelectValue placeholder="Select Journey Variant" />
          </SelectTrigger>
          <SelectContent>
            {journeys.map((j) => (
              <SelectItem key={j.journeyId} value={j.journeyId} className="text-xs">
                <div className="flex items-center justify-between gap-2 w-full">
                  <span className="font-semibold">{j.label}</span>
                  <Badge variant="outline" className="font-mono text-[9px] border-zinc-700">
                    {j.diffSummary}
                  </Badge>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* 2. Toolbar: Filter, Density, Sort */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/40 text-xs">
          {/* Segmented Filter */}
          <div className="flex items-center rounded-md border border-input p-0.5 bg-muted/40">
            {(['all', 'confirmed', 'possible', 'rejected'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'px-2 py-0.5 rounded text-[10px] font-mono capitalize transition-colors',
                  statusFilter === s
                    ? 'bg-background text-foreground font-bold shadow-xs'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 font-mono text-[10px]">
            {/* Sort Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setSortOrder((prev) => (prev === 'chronological' ? 'confidence' : 'chronological'))
              }
              className="h-6 px-1.5 text-[10px] text-muted-foreground gap-1"
              title="Toggle Chronological / Confidence Sort"
            >
              <ArrowUpDown className="h-3 w-3" />
              {sortOrder === 'chronological' ? 'Time' : 'Score'}
            </Button>

            {/* Density Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setDensity((prev) => (prev === 'detailed' ? 'compact' : 'detailed'))
              }
              className="h-6 px-1.5 text-[10px] text-muted-foreground"
              title="Toggle Compact / Detailed Density"
            >
              {density === 'detailed' ? 'Compact' : 'Detailed'}
            </Button>
          </div>
        </div>
      </CardHeader>

      {/* 3. Scrollable Timeline Rail & Cards */}
      <CardContent className="p-3.5 space-y-4 flex-1 overflow-y-auto">
        <div className="relative border-l-2 border-border ml-3 space-y-4">
          {displayHops.map((hop, idx) => {
            const isSelected = selectedHopIndex === (hop.hopNumber - 1);
            const isHovered = hoveredHopIndex === (hop.hopNumber - 1);
            const isConfirmed = hop.status === 'confirmed';
            const isRejected = hop.status === 'rejected';
            const isCollapsed = Boolean(collapsedHopIds[hop.sightingId]);

            return (
              <React.Fragment key={hop.sightingId}>
                {/* TRANSITION CONNECTOR CHIP (Rendered between hops) */}
                {idx > 0 && (
                  <div className="relative pl-6 py-0.5 my-1">
                    {/* Connector dot */}
                    <div className="absolute -left-[5px] top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-border" />
                    <div className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
                      <span>{Math.round(hop.transition.elapsedSeconds / 60)} min</span>
                      <span>•</span>
                      <span>{hop.transition.distanceMeters}m walk</span>
                      <span>•</span>

                      {/* Plausibility Tag */}
                      <span
                        className={cn(
                          'flex items-center gap-1 font-semibold',
                          hop.transition.plausibility === 'plausible'
                            ? 'text-emerald-400'
                            : hop.transition.plausibility === 'tight' || hop.transition.plausibility === 'slow'
                            ? 'text-amber-400'
                            : 'text-zinc-400',
                        )}
                        title="Kinematic travel plausibility check against camera topology distance & time bounds"
                      >
                        {hop.transition.plausibility === 'plausible' ? (
                          <>
                            <CheckCircle2 className="h-3 w-3" /> Transition Plausible
                          </>
                        ) : hop.transition.plausibility === 'tight' ? (
                          <>
                            <AlertTriangle className="h-3 w-3" /> Tight Window
                          </>
                        ) : hop.transition.plausibility === 'slow' ? (
                          <>
                            <Clock className="h-3 w-3" /> Slow Transit
                          </>
                        ) : (
                          <>Unobserved Gap ({hop.transition.gapMinutes || 14} min)</>
                        )}
                      </span>

                      {hop.transition.gapMinutes && (
                        <button
                          type="button"
                          onClick={onOpenSearchSheet}
                          className="text-cyan-400 underline hover:text-cyan-300 ml-1"
                        >
                          Suggest cameras
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* HOP CARD */}
                <div
                  ref={(el) => {
                    hopCardRefs.current[hop.hopNumber - 1] = el;
                  }}
                  className={cn(
                    'relative pl-6 transition-all rounded-lg border bg-card p-3 space-y-2 cursor-pointer shadow-2xs group',
                    isSelected
                      ? 'border-primary ring-2 ring-primary/20 bg-muted/20'
                      : 'border-border hover:border-cyan-500/50',
                    isHovered && 'ring-1 ring-cyan-500/40',
                  )}
                  onMouseEnter={() => onHoverHopIndex(hop.hopNumber - 1)}
                  onMouseLeave={() => onHoverHopIndex(null)}
                  onClick={() => onSelectHopIndex(hop.hopNumber - 1)}
                >
                  {/* Timeline Rail Bullet */}
                  <div
                    className={cn(
                      'absolute -left-3.5 top-3.5 flex h-7 w-7 items-center justify-center rounded-full border-2 font-mono text-[11px] font-bold shadow-md transition-transform',
                      isSelected && 'scale-110 ring-2 ring-primary/30',
                      isConfirmed
                        ? 'bg-blue-600 text-white border-white'
                        : isRejected
                        ? 'bg-zinc-800 text-zinc-400 border-zinc-600'
                        : 'bg-zinc-900 text-amber-400 border-amber-500 border-dashed',
                    )}
                  >
                    {hop.hopNumber}
                  </div>

                  {/* 1. Header row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-xs text-foreground truncate">
                          {hop.cameraName}
                        </span>
                        {hop.isNew && (
                          <Badge className="text-[9px] font-mono px-1 py-0 bg-cyan-600 text-white animate-pulse">
                            NEW
                          </Badge>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono flex items-center gap-2 mt-0.5">
                        <span>{hop.zone}</span>
                        <span>•</span>
                        <span>Dwell: {hop.dwellTimeSeconds}s</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground shrink-0">
                      <Clock className="h-3 w-3" />
                      <span title={new Date(hop.timestamp).toLocaleString()}>
                        {new Date(hop.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleHopCollapse(hop.sightingId);
                        }}
                        className="p-1 hover:text-foreground text-muted-foreground rounded"
                        title={isCollapsed ? 'Expand card' : 'Collapse card'}
                      >
                        {isCollapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
                      </button>
                    </div>
                  </div>

                  {/* COMPACT MODE SUMMARY */}
                  {(density === 'compact' || isCollapsed) ? (
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-border/30">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-muted-foreground">Fused:</span>
                        <span className="font-mono font-bold text-foreground">
                          {Math.round(hop.scores.fused * 100)}%
                        </span>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[9px] font-mono uppercase px-1.5 py-0',
                          isConfirmed
                            ? 'text-blue-400 border-blue-500/40 bg-blue-950/20'
                            : isRejected
                            ? 'text-red-400 border-red-500/40 bg-red-950/20'
                            : 'text-amber-400 border-amber-500/40 bg-amber-950/20',
                        )}
                      >
                        {isConfirmed ? 'Confirmed' : isRejected ? 'Rejected' : 'Possible'}
                      </Badge>
                    </div>
                  ) : (
                    /* DETAILED MODE CONTENT */
                    <>
                      {/* 2. Evidence Thumbnails Row */}
                      <div className="flex items-center gap-2.5 p-2 rounded bg-muted/30 border border-border/40">
                        <div
                          className="flex items-center gap-1.5 shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenEvidenceModal(hop);
                          }}
                          title="Click to inspect evidence in detail"
                        >
                          {/* Reference Photo */}
                          <div className="relative h-12 w-12 rounded overflow-hidden border bg-black shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={hop.thumbnails.referenceUrl}
                              alt="Reference"
                              className="h-full w-full object-cover"
                            />
                            <span className="absolute bottom-0 inset-x-0 bg-black/70 text-[8px] font-mono text-center text-zinc-300">
                              REF
                            </span>
                          </div>

                          {/* CCTV Crop */}
                          <div className="relative h-12 w-12 rounded overflow-hidden border border-cyan-500/50 bg-black shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={hop.thumbnails.cctvCropUrl}
                              alt="CCTV Match"
                              className="h-full w-full object-cover"
                            />
                            <span className="absolute bottom-0 inset-x-0 bg-black/70 text-[8px] font-mono text-center text-cyan-300">
                              CROP
                            </span>
                          </div>
                        </div>

                        <div className="min-w-0 flex-1 space-y-1 text-[11px] font-mono">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Track ID:</span>
                            <span className="text-cyan-400 font-bold">{hop.trackId}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Face Tag:</span>
                            <span className={hop.thumbnails.faceDetected ? 'text-blue-400' : 'text-zinc-400'}>
                              {hop.thumbnails.faceDetected ? 'Visible (Aligned)' : 'Not Visible'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Crop Quality:</span>
                            <span className="text-foreground font-semibold">{hop.thumbnails.qualityScore}%</span>
                          </div>
                        </div>
                      </div>

                      {/* 3. Score Block with 4 Mini Bars + Fused Score */}
                      <div className="space-y-1.5 rounded border bg-muted/20 p-2 text-xs font-mono">
                        <div className="flex items-center justify-between border-b pb-1">
                          <span className="text-[10px] uppercase text-muted-foreground font-semibold">
                            Fused Evidence Score
                          </span>
                          <span className="text-sm font-bold text-foreground">
                            {Math.round(hop.scores.fused * 100)}%
                          </span>
                        </div>

                        {/* 4 Mini Bars (Never red/green!) */}
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
                          <div>
                            <div className="flex justify-between text-muted-foreground">
                              <span>Face:</span>
                              <span className="text-foreground">
                                {hop.scores.face !== null ? `${Math.round(hop.scores.face * 100)}%` : 'n/a'}
                              </span>
                            </div>
                            <Progress value={hop.scores.face !== null ? hop.scores.face * 100 : 0} className="h-1" />
                          </div>

                          <div>
                            <div className="flex justify-between text-muted-foreground">
                              <span>Re-ID:</span>
                              <span className="text-foreground">{Math.round(hop.scores.reid * 100)}%</span>
                            </div>
                            <Progress value={hop.scores.reid * 100} className="h-1" />
                          </div>

                          <div>
                            <div className="flex justify-between text-muted-foreground">
                              <span>Temporal:</span>
                              <span className="text-foreground">{Math.round(hop.scores.temporal * 100)}%</span>
                            </div>
                            <Progress value={hop.scores.temporal * 100} className="h-1" />
                          </div>

                          <div>
                            <div className="flex justify-between text-muted-foreground">
                              <span>Camera Plaus:</span>
                              <span className="text-foreground">{Math.round(hop.scores.cameraPlausibility * 100)}%</span>
                            </div>
                            <Progress value={hop.scores.cameraPlausibility * 100} className="h-1" />
                          </div>
                        </div>
                      </div>

                      {/* 4. Status Row */}
                      <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground pt-0.5">
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[9px] font-mono uppercase px-1.5 py-0',
                            isConfirmed
                              ? 'text-blue-400 border-blue-500/40 bg-blue-950/20'
                              : isRejected
                              ? 'text-red-400 border-red-500/40 bg-red-950/20'
                              : 'text-amber-400 border-amber-500/40 bg-amber-950/20',
                          )}
                        >
                          {isConfirmed
                            ? `✓ Confirmed by ${hop.reviewInfo.reviewedBy || 'Reviewer'}`
                            : isRejected
                            ? `✕ Rejected: ${hop.reviewInfo.notes || 'Mismatch'}`
                            : '⚠ Possible Candidate (Unverified)'}
                        </Badge>
                      </div>

                      {/* 5. Actions Bar (permission gated) */}
                      <div
                        className="flex flex-wrap items-center justify-between gap-1.5 pt-1.5 border-t border-border/40 text-xs"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onOpenEvidenceModal(hop)}
                            className="h-6 px-1.5 text-[10px] gap-1"
                            title="Inspect high-res frame and face landmarks"
                          >
                            <Maximize2 className="h-3 w-3" /> Evidence
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onFocusMapHop?.(hop.hopNumber - 1)}
                            className="h-6 px-1.5 text-[10px] gap-1 text-muted-foreground"
                            title="Pan and focus map on this camera node"
                          >
                            <Crosshair className="h-3 w-3" /> Focus
                          </Button>
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isRejected}
                            onClick={() => handleOpenRejectDialog(hop.sightingId)}
                            className="h-6 px-1.5 text-[10px] text-red-400 hover:text-red-300 border-red-500/30"
                          >
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            variant="default"
                            disabled={isConfirmed}
                            onClick={() => onConfirmHop(hop.sightingId)}
                            className="h-6 px-2 text-[10px] bg-blue-600 hover:bg-blue-500 text-white font-medium"
                          >
                            Confirm
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </React.Fragment>
            );
          })}

          {/* 4. END OF TIMELINE: Dashed "Now" Node */}
          <div className="relative pl-6 pt-2 space-y-3">
            {/* Dashed Now Marker */}
            <div className="absolute -left-3 top-2.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-dashed border-cyan-400 bg-background text-cyan-400 font-mono text-[9px] font-bold">
              NOW
            </div>

            <div className="p-3 rounded-lg border border-dashed border-cyan-500/40 bg-muted/20 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground">
                  Last seen {activeJourney.reachableArea.elapsedMinutes} min ago at{' '}
                  {activeJourney.hops[activeJourney.hops.length - 1]?.cameraId || 'CAM-04'}
                </span>
                <Badge variant="outline" className="text-[9px] font-mono text-cyan-400 border-cyan-500/40">
                  r = {activeJourney.reachableArea.radiusMeters}m
                </Badge>
              </div>

              <p className="text-[11px] text-muted-foreground">
                Estimated reachable area (1.4 m/s walking speed). Highlighted below are suggested next cameras:
              </p>

              {/* 3 Suggested Cameras */}
              <div className="space-y-1.5">
                {activeJourney.suggestedCameras.map((cam) => (
                  <div
                    key={cam.cameraId}
                    className="p-2 rounded border bg-card/80 flex items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <div className="font-semibold text-foreground text-xs">{cam.name}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">
                        {cam.distanceMeters}m • Expected arrival: {cam.expectedArrivalWindowMin}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={onOpenSearchSheet}
                      className="h-6 px-2 text-[10px] font-mono text-cyan-400"
                    >
                      <Search className="h-3 w-3 mr-1" /> Search here
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </CardContent>

      {/* Reject Reason Notes Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2 text-red-400">
              <XCircle className="h-4 w-4" /> Reject Candidate Sighting
            </DialogTitle>
            <DialogDescription className="text-xs">
              A review note is required to reject this hop and update the audit log.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Textarea
              placeholder="Provide reason for rejection (e.g. clothing color mismatch, distinct facial feature discrepancy)..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="text-xs min-h-[90px]"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRejectDialogOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={!rejectReason.trim()}
              onClick={handleConfirmReject}
              className="text-xs"
            >
              Submit Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
