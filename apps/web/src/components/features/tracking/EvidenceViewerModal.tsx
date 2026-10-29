'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DetailedHopNode } from '@/types/tracking';
import {
  ScanFace,
  Layers,
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  Shield,
  Compass,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EvidenceViewerModalProps {
  hop: DetailedHopNode | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm?: (sightingId: string) => void;
  onReject?: (sightingId: string) => void;
}

export function EvidenceViewerModal({
  hop,
  open,
  onOpenChange,
  onConfirm,
  onReject,
}: EvidenceViewerModalProps) {
  if (!hop) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl p-0 overflow-hidden bg-background border-border">
        <DialogHeader className="p-4 border-b bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge className="font-mono text-xs">HOP #{hop.hopNumber}</Badge>
              <DialogTitle className="text-sm font-bold">{hop.cameraName}</DialogTitle>
            </div>
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] font-mono uppercase',
                hop.status === 'confirmed'
                  ? 'border-blue-500/60 text-blue-400 bg-blue-950/20'
                  : 'border-amber-500/60 text-amber-400 bg-amber-950/20',
              )}
            >
              {hop.status === 'confirmed' ? 'Confirmed Sighting' : 'Possible Candidate'}
            </Badge>
          </div>
          <DialogDescription className="text-xs text-muted-foreground flex items-center gap-3 pt-1 font-mono">
            <span>{hop.zone}</span>
            <span>•</span>
            <span>{new Date(hop.timestamp).toLocaleString()}</span>
            <span>•</span>
            <span>Track: {hop.trackId}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="p-4 space-y-4 text-xs">
          {/* Main Evidence Frame Preview */}
          <div className="relative aspect-video w-full rounded-lg overflow-hidden border bg-black flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={hop.thumbnails.frameUrl || hop.thumbnails.cctvCropUrl}
              alt="CCTV Full Evidence Frame"
              className="w-full h-full object-contain"
            />
            {/* Highlighted Bounding Box */}
            <div className="absolute inset-x-1/3 inset-y-1/4 border-2 border-cyan-400 bg-cyan-500/10 rounded flex items-start justify-end p-1 pointer-events-none">
              <span className="text-[9px] font-mono font-bold bg-cyan-500 text-black px-1 rounded">
                CANDIDATE {Math.round(hop.scores.fused * 100)}%
              </span>
            </div>
          </div>

          {/* Side by side comparison crops */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-lg border bg-muted/20 space-y-2">
              <span className="text-xs font-semibold text-foreground block">
                Reference Dossier Photo
              </span>
              <div className="aspect-square w-full rounded overflow-hidden border bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={hop.thumbnails.referenceUrl}
                  alt="Reference"
                  className="w-full h-full object-cover"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                High-resolution enrolled reference photo.
              </p>
            </div>

            <div className="p-3 rounded-lg border bg-muted/20 space-y-2">
              <span className="text-xs font-semibold text-foreground block">
                CCTV Extracted Crop
              </span>
              <div className="aspect-square w-full rounded overflow-hidden border border-cyan-500/40 bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={hop.thumbnails.cctvCropUrl}
                  alt="CCTV Crop"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                <span>Aligned: {hop.thumbnails.faceDetected ? 'Yes' : 'No'}</span>
                <span>Quality: {hop.thumbnails.qualityScore}/100</span>
              </div>
            </div>
          </div>

          {/* Scores Breakdown */}
          <div className="grid grid-cols-4 gap-2 rounded bg-muted/30 p-2.5 text-center font-mono text-xs border">
            <div>
              <span className="text-[9px] text-muted-foreground block">Face (ArcFace)</span>
              <span className="font-bold text-foreground">
                {hop.scores.face !== null ? `${Math.round(hop.scores.face * 100)}%` : 'n/a'}
              </span>
            </div>
            <div>
              <span className="text-[9px] text-muted-foreground block">Re-ID (OSNet)</span>
              <span className="font-bold text-foreground">{Math.round(hop.scores.reid * 100)}%</span>
            </div>
            <div>
              <span className="text-[9px] text-muted-foreground block">Temporal</span>
              <span className="font-bold text-foreground">{Math.round(hop.scores.temporal * 100)}%</span>
            </div>
            <div>
              <span className="text-[9px] text-muted-foreground block">Fused Score</span>
              <span className="font-bold text-cyan-400">{Math.round(hop.scores.fused * 100)}%</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3 border-t bg-muted/30 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onReject?.(hop.sightingId);
                onOpenChange(false);
              }}
              className="text-red-400 border-red-500/40"
            >
              <XCircle className="h-3.5 w-3.5 mr-1" /> Reject Sighting
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                onConfirm?.(hop.sightingId);
                onOpenChange(false);
              }}
              className="bg-blue-600 hover:bg-blue-500 text-white"
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Confirm Sighting
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
