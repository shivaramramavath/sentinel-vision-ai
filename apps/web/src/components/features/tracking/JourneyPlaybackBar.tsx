'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { DetailedJourney, DetailedHopNode } from '@/types/tracking';
import {
  Play,
  Pause,
  RotateCcw,
  Film,
  Camera,
  Clock,
  ChevronRight,
  ChevronLeft,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface JourneyPlaybackBarProps {
  journey: DetailedJourney;
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onReset: () => void;
  playbackProgress: number; // 0.0 to 1.0
  onSeekProgress: (progress: number) => void;
  playbackSpeed: number;
  onChangeSpeed: (speed: number) => void;
  className?: string;
}

export function JourneyPlaybackBar({
  journey,
  selectedIndex,
  onSelectIndex,
  isPlaying,
  onTogglePlay,
  onReset,
  playbackProgress,
  onSeekProgress,
  playbackSpeed,
  onChangeSpeed,
  className,
}: JourneyPlaybackBarProps) {
  const [isClipsModalOpen, setIsClipsModalOpen] = useState(false);
  const [activeClipIndex, setActiveClipIndex] = useState(0);
  const [isClipPlaying, setIsClipPlaying] = useState(true);

  const totalHops = journey.hops.length;
  const currentHop = journey.hops[selectedIndex] || journey.hops[0];

  const handleOpenClips = () => {
    setActiveClipIndex(selectedIndex);
    setIsClipsModalOpen(true);
    setIsClipPlaying(true);
  };

  return (
    <div className={cn('border-t p-3 bg-card/95 backdrop-blur-xs flex flex-col gap-2', className)}>
      <div className="flex items-center justify-between gap-3 text-xs">
        {/* Playback Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            variant={isPlaying ? 'secondary' : 'default'}
            size="sm"
            className="h-8 w-8 p-0"
            onClick={onTogglePlay}
            title={isPlaying ? 'Pause Playback' : 'Play Trajectory Animation'}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground"
            onClick={onReset}
            title="Reset to Start"
            aria-label="Reset"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Scrub Slider with Tick Marks */}
        <div className="flex-1 px-2 relative flex flex-col justify-center">
          <Slider
            value={[Math.round(playbackProgress * 100)]}
            onValueChange={(val) => {
              const fraction = val[0] / 100;
              onSeekProgress(fraction);
            }}
            min={0}
            max={100}
            step={1}
            aria-label="Scrub journey timeline"
          />

          {/* Hop Tick Marks Along Slider */}
          <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 flex justify-between pointer-events-none">
            {journey.hops.map((_, i) => {
              const isPast = (i / (totalHops - 1 || 1)) <= playbackProgress;
              return (
                <span
                  key={i}
                  className={cn(
                    'h-1.5 w-1.5 rounded-full border border-background shadow-xs transition-colors',
                    isPast ? 'bg-primary' : 'bg-muted-foreground/40',
                  )}
                />
              );
            })}
          </div>
        </div>

        {/* Speed Selector & Play Clips Button */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1 font-mono text-[10px]">
            <span className="text-muted-foreground hidden sm:inline">Speed:</span>
            {[1, 2, 4].map((s) => (
              <Button
                key={s}
                variant={playbackSpeed === s ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 px-2 text-[10px] font-mono"
                onClick={() => onChangeSpeed(s)}
              >
                {s}x
              </Button>
            ))}
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={handleOpenClips}
            className="h-7 px-2.5 text-xs gap-1.5 font-mono text-cyan-400 border-cyan-500/40 hover:bg-cyan-950/20"
            title="Play 10s video evidence clips for each hop sequentially"
          >
            <Film className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Play Clips</span>
          </Button>
        </div>
      </div>

      {/* Playback Progress Status Text */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono px-1">
        <span>Start: {new Date(journey.firstSeenAt).toLocaleTimeString()}</span>
        <span className="font-semibold text-foreground">
          Current: Hop #{selectedIndex + 1} of {totalHops} ({Math.round(playbackProgress * 100)}%)
          {currentHop && ` • ${currentHop.cameraName}`}
        </span>
        <span>End: {new Date(journey.lastSeenAt).toLocaleTimeString()}</span>
      </div>

      {/* Sequential Evidence Clips Modal */}
      <Dialog open={isClipsModalOpen} onOpenChange={setIsClipsModalOpen}>
        <DialogContent className="sm:max-w-xl p-0 overflow-hidden bg-black border-zinc-800 text-white">
          <DialogHeader className="p-4 border-b border-zinc-800 bg-zinc-950/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Film className="h-4 w-4 text-cyan-400" />
                <DialogTitle className="text-sm font-bold text-white">
                  Evidence Clips Sequence — Hop #{activeClipIndex + 1} of {totalHops}
                </DialogTitle>
              </div>
              <Badge variant="outline" className="font-mono text-[10px] text-zinc-300 border-zinc-700">
                10-Second Segments
              </Badge>
            </div>
            <DialogDescription className="text-xs text-zinc-400">
              {journey.hops[activeClipIndex]?.cameraName} • {new Date(journey.hops[activeClipIndex]?.timestamp || '').toLocaleTimeString()}
            </DialogDescription>
          </DialogHeader>

          {/* Video / Frame Viewport */}
          <div className="relative aspect-video w-full bg-black flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={journey.hops[activeClipIndex]?.thumbnails.frameUrl || journey.hops[activeClipIndex]?.thumbnails.cctvCropUrl}
              alt="CCTV Evidence Frame"
              className="w-full h-full object-contain"
            />

            {/* Bounding Box overlay */}
            <div className="absolute inset-x-1/3 inset-y-1/4 border-2 border-cyan-400 bg-cyan-500/10 rounded flex items-start justify-end p-1 pointer-events-none">
              <span className="text-[9px] font-mono font-bold bg-cyan-500 text-black px-1 rounded">
                TRK: {journey.hops[activeClipIndex]?.trackId}
              </span>
            </div>

            {/* Hop counter pill */}
            <div className="absolute bottom-3 left-3 bg-black/70 px-2 py-1 rounded text-xs font-mono text-zinc-300 backdrop-blur-md">
              Hop #{activeClipIndex + 1}: {journey.hops[activeClipIndex]?.cameraName}
            </div>
          </div>

          {/* Sequencer Bar */}
          <div className="p-3 bg-zinc-950 flex items-center justify-between border-t border-zinc-800">
            <Button
              variant="outline"
              size="sm"
              disabled={activeClipIndex === 0}
              onClick={() => setActiveClipIndex((prev) => Math.max(0, prev - 1))}
              className="h-8 text-xs border-zinc-800 text-zinc-300"
            >
              <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Previous Hop
            </Button>

            <div className="flex items-center gap-1.5 font-mono text-xs">
              {journey.hops.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActiveClipIndex(i)}
                  className={cn(
                    'h-6 w-6 rounded text-[10px] font-bold transition-colors',
                    activeClipIndex === i
                      ? 'bg-cyan-500 text-black'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700',
                  )}
                >
                  {i + 1}
                </button>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              disabled={activeClipIndex === totalHops - 1}
              onClick={() => setActiveClipIndex((prev) => Math.min(totalHops - 1, prev + 1))}
              className="h-8 text-xs border-zinc-800 text-zinc-300"
            >
              Next Hop <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
