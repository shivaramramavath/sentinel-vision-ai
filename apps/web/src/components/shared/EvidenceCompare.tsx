'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import {
  Maximize2,
  Minimize2,
  SplitSquareVertical,
  Sliders,
  Video,
  Camera,
  Layers,
  Sparkles,
  Play,
  RotateCcw,
} from 'lucide-react';
import { ReferencePhoto } from '@/types';

interface EvidenceCompareProps {
  referencePhotos: ReferencePhoto[];
  activeReferenceUrl: string;
  onSelectReference?: (ref: ReferencePhoto) => void;
  candidateCropUrl: string;
  candidateFrameUrl?: string;
  videoClipUrl?: string;
  faceDetected?: boolean;
  qualityScore?: number;
  poseLabel?: string;
  className?: string;
}

export function EvidenceCompare({
  referencePhotos = [],
  activeReferenceUrl,
  onSelectReference,
  candidateCropUrl,
  candidateFrameUrl,
  videoClipUrl,
  faceDetected = true,
  qualityScore = 90,
  poseLabel = '3/4 Left Profile',
  className,
}: EvidenceCompareProps) {
  const [viewMode, setViewMode] = useState<'side-by-side' | 'slider' | 'clip'>('side-by-side');
  const [showFullFrame, setShowFullFrame] = useState(false);
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isPlayingClip, setIsPlayingClip] = useState(false);

  const currentRefUrl =
    activeReferenceUrl ||
    referencePhotos[0]?.url ||
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80';

  const displayCandidateUrl =
    showFullFrame && candidateFrameUrl ? candidateFrameUrl : candidateCropUrl;

  return (
    <div className={cn('flex flex-col rounded-xl border bg-card overflow-hidden', className)}>
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between border-b px-4 py-2.5 bg-muted/20 gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-[10px] uppercase">
            {poseLabel}
          </Badge>
          {faceDetected ? (
            <Badge variant="secondary" className="text-[10px] font-mono border">
              Face Visible
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground">
              Body Re-ID Only
            </Badge>
          )}
          <Badge variant="outline" className="text-[10px] font-mono">
            Quality: {qualityScore}%
          </Badge>
        </div>

        {/* View Mode Controls */}
        <div className="flex items-center gap-1.5">
          {candidateFrameUrl && (
            <Button
              variant={showFullFrame ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setShowFullFrame(!showFullFrame)}
              className="h-7 text-xs gap-1 px-2"
            >
              <Camera className="h-3.5 w-3.5" />
              {showFullFrame ? 'Tight Crop' : 'Full Frame Context'}
            </Button>
          )}

          <div className="flex items-center border rounded-md p-0.5 bg-background">
            <Button
              variant={viewMode === 'side-by-side' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('side-by-side')}
              className="h-6 px-2 text-[11px] gap-1"
            >
              <SplitSquareVertical className="h-3 w-3" />
              Side-by-Side
            </Button>
            <Button
              variant={viewMode === 'slider' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('slider')}
              className="h-6 px-2 text-[11px] gap-1"
            >
              <Sliders className="h-3 w-3" />
              Slider
            </Button>
            <Button
              variant={viewMode === 'clip' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('clip')}
              className="h-6 px-2 text-[11px] gap-1"
            >
              <Video className="h-3 w-3" />
              10s Clip
            </Button>
          </div>
        </div>
      </div>

      {/* Main Inspection Canvas */}
      <div className="flex flex-1 min-h-[360px] max-h-[480px]">
        {/* Left Rail: Multi-Angle Reference Photos (Clickable) */}
        {referencePhotos.length > 0 && (
          <div className="w-20 border-r bg-muted/10 p-2 flex flex-col gap-2 overflow-y-auto shrink-0 select-none">
            <span className="text-[9px] font-mono uppercase text-muted-foreground text-center">
              Ref Photos
            </span>
            {referencePhotos.map((ref, idx) => {
              const isSelected = ref.url === currentRefUrl;
              return (
                <button
                  key={ref.id || idx}
                  onClick={() => onSelectReference?.(ref)}
                  className={cn(
                    'group relative aspect-square rounded-md overflow-hidden border-2 transition-all',
                    isSelected
                      ? 'border-primary ring-2 ring-primary/20'
                      : 'border-transparent opacity-70 hover:opacity-100',
                  )}
                  title={`${ref.type} (${ref.qualityScore}%)`}
                >
                  <img src={ref.url} alt={`Ref ${idx}`} className="h-full w-full object-cover" />
                  <span className="absolute bottom-0 inset-x-0 bg-background/80 text-[8px] font-mono text-center truncate px-0.5">
                    {ref.type}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Center: Comparison Viewport */}
        <div className="flex-1 relative flex items-center justify-center p-4 bg-muted/5">
          {viewMode === 'side-by-side' && (
            <div className="grid grid-cols-2 gap-4 w-full h-full max-h-[420px]">
              {/* Reference Image */}
              <div className="relative rounded-lg border bg-background overflow-hidden flex flex-col">
                <div className="absolute top-2 left-2 z-10">
                  <Badge variant="secondary" className="text-[10px] font-mono shadow-sm">
                    Reference Photo
                  </Badge>
                </div>
                <div className="flex-1 relative flex items-center justify-center p-2">
                  <img
                    src={currentRefUrl}
                    alt="Reference"
                    className="max-h-[360px] w-auto object-contain rounded"
                  />
                </div>
              </div>

              {/* Candidate CCTV Crop */}
              <div className="relative rounded-lg border bg-background overflow-hidden flex flex-col">
                <div className="absolute top-2 left-2 z-10 flex gap-1">
                  <Badge variant="default" className="text-[10px] font-mono shadow-sm bg-primary text-primary-foreground">
                    CCTV Candidate Crop
                  </Badge>
                  {showFullFrame && (
                    <Badge variant="outline" className="text-[10px] font-mono bg-background/80">
                      Full Frame
                    </Badge>
                  )}
                </div>
                <div className="flex-1 relative flex items-center justify-center p-2">
                  <img
                    src={displayCandidateUrl}
                    alt="Candidate"
                    className="max-h-[360px] w-auto object-contain rounded"
                  />
                </div>
              </div>
            </div>
          )}

          {viewMode === 'slider' && (
            <div className="relative w-full max-w-[500px] h-[360px] rounded-lg border overflow-hidden select-none">
              {/* Candidate image in background */}
              <img
                src={displayCandidateUrl}
                alt="Candidate Background"
                className="absolute inset-0 h-full w-full object-cover"
              />
              {/* Reference image in foreground with clip path */}
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${sliderPosition}%` }}
              >
                <img
                  src={currentRefUrl}
                  alt="Reference Overlay"
                  className="absolute inset-0 h-full w-full object-cover max-w-none"
                  style={{ width: '500px' }}
                />
              </div>

              {/* Divider line */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-primary shadow-lg pointer-events-none"
                style={{ left: `${sliderPosition}%` }}
              >
                <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-mono shadow">
                  ↔
                </div>
              </div>

              {/* Slider Input overlay */}
              <input
                type="range"
                min="0"
                max="100"
                value={sliderPosition}
                onChange={(e) => setSliderPosition(Number(e.target.value))}
                className="absolute inset-0 opacity-0 cursor-ew-resize w-full h-full"
                aria-label="Comparison slider"
              />

              <div className="absolute bottom-2 left-2 z-10">
                <Badge variant="secondary" className="text-[10px] font-mono">
                  Ref: {sliderPosition}% | CCTV: {100 - sliderPosition}%
                </Badge>
              </div>
            </div>
          )}

          {viewMode === 'clip' && (
            <div className="relative w-full max-w-xl aspect-video rounded-lg border bg-black overflow-hidden flex items-center justify-center">
              <img
                src={candidateCropUrl}
                alt="Clip Poster"
                className={cn(
                  'absolute inset-0 w-full h-full object-cover opacity-80',
                  isPlayingClip && 'scale-105 transition-all duration-3000',
                )}
              />

              {/* Bounding box track overlay */}
              <div className="absolute top-1/4 left-1/3 w-28 h-56 border-2 border-primary rounded animate-pulse">
                <span className="absolute -top-5 left-0 text-[10px] font-mono bg-primary text-primary-foreground px-1 rounded">
                  Track #10492
                </span>
              </div>

              {/* Play / Pause button */}
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsPlayingClip(!isPlayingClip)}
                className="z-10 h-12 w-12 rounded-full bg-background/80 hover:bg-background"
              >
                {isPlayingClip ? <RotateCcw className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
              </Button>

              <div className="absolute bottom-2 inset-x-2 flex justify-between items-center text-white/90 text-xs px-2 py-1 bg-black/60 rounded">
                <span>00:{isPlayingClip ? '06' : '00'} / 00:10</span>
                <span className="text-[10px] font-mono">25.0 FPS • 1080p H.264</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
