'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { DetailedHopNode } from '@/types/tracking';
import {
  MapPin,
  Clock,
  Compass,
  Layers,
  ScanFace,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldAlert,
  Sliders,
  History,
  Maximize2,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SelectedHopCardProps {
  hop: DetailedHopNode;
  onConfirm?: (sightingId: string) => void;
  onReject?: (sightingId: string) => void;
  onOpenEvidenceModal?: (hop: DetailedHopNode) => void;
  className?: string;
}

export function SelectedHopCard({
  hop,
  onConfirm,
  onReject,
  onOpenEvidenceModal,
  className,
}: SelectedHopCardProps) {
  const [sliderPosition, setSliderPosition] = useState(50); // 0 to 100%
  const [isDragging, setIsDragging] = useState(false);

  const isConfirmed = hop.status === 'confirmed';
  const isRejected = hop.status === 'rejected';

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    setSliderPosition((x / rect.width) * 100);
  };

  return (
    <Card className={cn('overflow-hidden border bg-card shadow-sm', className)}>
      <CardHeader className="p-3 border-b bg-muted/20 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <Badge className="font-mono text-[10px] font-bold bg-primary text-primary-foreground">
            HOP #{hop.hopNumber}
          </Badge>
          <div className="min-w-0">
            <CardTitle className="text-xs font-bold text-foreground truncate">
              {hop.cameraName}
            </CardTitle>
            <span className="text-[10px] text-muted-foreground font-mono block">
              {hop.zone} • ID: {hop.cameraId}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Badge
            variant="outline"
            className={cn(
              'text-[10px] font-mono uppercase px-2 py-0.5',
              isConfirmed
                ? 'border-blue-500/60 bg-blue-950/20 text-blue-400'
                : isRejected
                ? 'border-red-500/60 bg-red-950/20 text-red-400'
                : 'border-amber-500/60 bg-amber-950/20 text-amber-400',
            )}
          >
            {isConfirmed
              ? '✓ Confirmed Sighting'
              : isRejected
              ? '✕ Rejected Sighting'
              : '⚠ Possible Candidate (Unverified)'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
          {/* 1. LEFT: Interactive Draggable Comparison Slider (5 cols) */}
          <div className="md:col-span-5 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-foreground">
                <Sliders className="h-3.5 w-3.5 text-cyan-400" />
                Reference vs CCTV Match
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                Drag divider to compare
              </span>
            </div>

            {/* Draggable Split Container */}
            <div
              className="relative aspect-square w-full rounded-lg overflow-hidden border select-none cursor-ew-resize bg-black"
              onMouseDown={() => setIsDragging(true)}
              onMouseUp={() => setIsDragging(false)}
              onMouseLeave={() => setIsDragging(false)}
              onMouseMove={handleMouseMove}
            >
              {/* Reference Image (Background / Right) */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={hop.thumbnails.referenceUrl}
                alt="Reference Dossier"
                className="absolute inset-0 w-full h-full object-cover pointer-events-none"
              />
              <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-mono text-white backdrop-blur-xs z-10 pointer-events-none">
                REFERENCE PHOTO
              </span>

              {/* Candidate CCTV Crop (Clipped / Left) */}
              <div
                className="absolute inset-0 overflow-hidden pointer-events-none"
                style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={hop.thumbnails.cctvCropUrl}
                  alt="Candidate CCTV Crop"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <span className="absolute bottom-2 left-2 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-mono text-cyan-300 backdrop-blur-xs z-10">
                  CCTV CROP
                </span>
              </div>

              {/* Divider Line & Handle */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-cyan-400 shadow-md z-20 pointer-events-none"
                style={{ left: `${sliderPosition}%` }}
              >
                <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-6 w-6 rounded-full bg-cyan-500 text-black shadow-lg flex items-center justify-center font-bold text-[10px]">
                  ↔
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono px-1">
              <span>Face Visible: {hop.thumbnails.faceDetected ? 'Yes (Aligned)' : 'No (Body Re-ID only)'}</span>
              <span>Crop Quality: {hop.thumbnails.qualityScore}/100</span>
            </div>
          </div>

          {/* 2. RIGHT: Per-Score Breakdown with Model Names & Audit Snippet (7 cols) */}
          <div className="md:col-span-7 space-y-3.5">
            {/* Top Telemetry Strip */}
            <div className="grid grid-cols-3 gap-2 rounded bg-muted/30 p-2.5 text-center text-xs font-mono border">
              <div>
                <span className="text-[9px] text-muted-foreground block uppercase">Dwell Time</span>
                <span className="font-bold text-foreground">{hop.dwellTimeSeconds}s</span>
              </div>
              <div>
                <span className="text-[9px] text-muted-foreground block uppercase">Direction</span>
                <span className="font-bold text-foreground">{hop.direction}</span>
              </div>
              <div>
                <span className="text-[9px] text-muted-foreground block uppercase">Track ID</span>
                <span className="font-bold text-cyan-400">{hop.trackId}</span>
              </div>
            </div>

            {/* Score Breakdown with Model Names */}
            <div className="space-y-2 rounded-lg border bg-muted/10 p-3">
              <div className="flex items-center justify-between border-b pb-1.5">
                <span className="text-xs font-semibold text-foreground">
                  Biometric Evidence Fusion Scores
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-[10px] text-muted-foreground uppercase font-mono">
                    Fused Score:
                  </span>
                  <span className="text-base font-mono font-bold text-foreground">
                    {Math.round(hop.scores.fused * 100)}%
                  </span>
                </div>
              </div>

              {/* 4 Mini Horizontal Bars */}
              <div className="space-y-2 pt-1 text-xs font-mono">
                {/* Face Score */}
                <div className="space-y-0.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">
                      Face Recognition (InsightFace ArcFace v2.1)
                    </span>
                    <span className="font-semibold text-foreground">
                      {hop.scores.face !== null ? `${Math.round(hop.scores.face * 100)}%` : 'n/a'}
                    </span>
                  </div>
                  <Progress value={hop.scores.face !== null ? hop.scores.face * 100 : 0} className="h-1.5" />
                </div>

                {/* Re-ID Score */}
                <div className="space-y-0.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">
                      Person Re-ID (OSNet-AIN x1.0 512-dim)
                    </span>
                    <span className="font-semibold text-foreground">
                      {Math.round(hop.scores.reid * 100)}%
                    </span>
                  </div>
                  <Progress value={hop.scores.reid * 100} className="h-1.5" />
                </div>

                {/* Temporal Score */}
                <div className="space-y-0.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">
                      Temporal Offset (NTP Calibrated Window)
                    </span>
                    <span className="font-semibold text-foreground">
                      {Math.round(hop.scores.temporal * 100)}%
                    </span>
                  </div>
                  <Progress value={hop.scores.temporal * 100} className="h-1.5" />
                </div>

                {/* Camera Plausibility */}
                <div className="space-y-0.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">
                      Camera Topology Plausibility (Graph Matrix)
                    </span>
                    <span className="font-semibold text-foreground">
                      {Math.round(hop.scores.cameraPlausibility * 100)}%
                    </span>
                  </div>
                  <Progress value={hop.scores.cameraPlausibility * 100} className="h-1.5" />
                </div>
              </div>
            </div>

            {/* Audit Trail Snippet */}
            <div className="rounded border bg-muted/20 p-2.5 text-xs space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground font-semibold text-[11px]">
                <History className="h-3 w-3" /> Audit Review Log
              </div>
              {hop.reviewInfo?.reviewedBy ? (
                <p className="text-[11px] text-foreground">
                  <span className="font-semibold">{hop.reviewInfo.reviewedBy}</span> reviewed this candidate at{' '}
                  <span className="font-mono text-muted-foreground">
                    {new Date(hop.reviewInfo.reviewedAt || hop.timestamp).toLocaleTimeString()}
                  </span>
                  {hop.reviewInfo.notes && ` — "${hop.reviewInfo.notes}"`}
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground italic">
                  Candidate has not yet been reviewed. Requires human review approval.
                </p>
              )}
            </div>

            {/* Actions Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/40">
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onOpenEvidenceModal?.(hop)}
                  className="h-7 px-2.5 text-xs gap-1"
                >
                  <Maximize2 className="h-3 w-3" /> View Evidence
                </Button>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isRejected}
                  onClick={() => onReject?.(hop.sightingId)}
                  className="h-7 px-2 text-xs text-red-400 hover:text-red-300 border-red-500/30 hover:bg-red-950/20"
                >
                  <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                </Button>
                <Button
                  size="sm"
                  variant="default"
                  disabled={isConfirmed}
                  onClick={() => onConfirm?.(hop.sightingId)}
                  className="h-7 px-2.5 text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Confirm Hop
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
