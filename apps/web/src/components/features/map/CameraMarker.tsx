'use client';

import React from 'react';
import { Camera } from '@/types';
import { MapMarker, MarkerContent, MarkerPopup, MarkerTooltip } from '@/components/ui/map';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Video, Radio, Users, Activity, Eye, Play } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CameraMarkerProps {
  camera: Camera;
  isSelected?: boolean;
  onClick?: (camera: Camera) => void;
  onOpenStream?: (camera: Camera) => void;
  onTrackHere?: (camera: Camera) => void;
  showPopup?: boolean;
  showTooltip?: boolean;
}

/**
 * Extracts strictly [longitude, latitude] coordinates from a camera object.
 */
export function getCameraCoords(camera: Camera): [number, number] {
  if (typeof camera.longitude === 'number' && typeof camera.latitude === 'number') {
    return [camera.longitude, camera.latitude];
  }
  if (camera.coords && camera.coords.length === 2) {
    // camera.coords is [latitude, longitude]
    return [camera.coords[1], camera.coords[0]];
  }
  return [-74.006, 40.7128];
}

/**
 * High-performance, monochrome-styled Camera Marker with semantic operational indicators:
 * - Green (online): edge sensor operational
 * - Red (offline): sensor disconnected
 * - Amber (degraded): degraded telemetry / possible match candidate in zone
 * - Blue (active track): active ByteTrack Re-ID identity track detected
 * Never uses green/red to imply confirmed or rejected person identity.
 */
export function CameraMarker({
  camera,
  isSelected = false,
  onClick,
  onOpenStream,
  onTrackHere,
  showPopup = true,
  showTooltip = false,
}: CameraMarkerProps) {
  const [lng, lat] = getCameraCoords(camera);

  const isLive = camera.status === 'live';
  const isOffline = camera.status === 'offline';
  const isDegraded = camera.status === 'degraded';
  const hasActiveDetections = (camera.activeDetections ?? 0) > 0;

  // Snapshot refresh every 2s for live hover tooltip
  const [snapshotTick, setSnapshotTick] = React.useState(0);
  React.useEffect(() => {
    if (!showTooltip) return;
    const interval = setInterval(() => {
      setSnapshotTick((t) => t + 1);
    }, 2000);
    return () => clearInterval(interval);
  }, [showTooltip]);

  // Semantic dot color
  const statusColor = isLive
    ? 'bg-emerald-500'
    : isDegraded
    ? 'bg-amber-500'
    : 'bg-rose-500';

  const statusText = isLive
    ? 'text-emerald-500'
    : isDegraded
    ? 'text-amber-500'
    : 'text-rose-500';

  return (
    <MapMarker
      longitude={lng}
      latitude={lat}
      onClick={() => onClick?.(camera)}
    >
      <MarkerContent>
        <div className="relative group cursor-pointer">
          {/* Active Track Blue Radar Pulse */}
          {hasActiveDetections && (
            <span className="absolute -inset-1.5 animate-ping rounded-full bg-blue-500/40" />
          )}

          {/* Core Monochrome Node Shell */}
          <div
            className={cn(
              'relative flex h-7 w-7 items-center justify-center rounded-full border-2 bg-background shadow-md transition-all duration-200',
              isSelected
                ? 'scale-125 border-foreground ring-4 ring-primary/40 z-20'
                : 'border-border/80 hover:scale-115 hover:border-foreground/80 z-10',
              hasActiveDetections && 'border-blue-500 ring-2 ring-blue-500/30',
            )}
          >
            {hasActiveDetections ? (
              <Radio className="h-3.5 w-3.5 text-blue-500 animate-pulse" />
            ) : (
              <Video className="h-3.5 w-3.5 text-foreground" />
            )}

            {/* Semantic operational status pip (top-right) */}
            <span
              className={cn(
                'absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-background shadow-sm',
                statusColor,
              )}
            />
          </div>
        </div>
      </MarkerContent>

      {showTooltip && (
        <MarkerTooltip offset={12} className="p-2 min-w-44 bg-background/95 backdrop-blur border shadow-md rounded-md space-y-1.5">
          <div className="relative h-20 w-full rounded overflow-hidden bg-black/60 border border-border/50 flex items-center justify-center">
            {/* eslint-disable-next-js-next-image-missing-attribute */}
            <img
              src={`https://images.unsplash.com/photo-1517649763962-0c623266ddc0?auto=format&fit=crop&w=300&q=70&t=${snapshotTick}`}
              alt={camera.name}
              className="h-full w-full object-cover"
            />
            <span className="absolute bottom-1 right-1 bg-black/80 text-[9px] font-mono text-white px-1 rounded">
              2s live snap
            </span>
          </div>
          <div>
            <div className="text-[11px] font-bold text-foreground truncate">{camera.name}</div>
            <div className="text-[10px] text-muted-foreground font-mono flex items-center justify-between mt-0.5">
              <span className={cn('capitalize font-medium', statusText)}>{camera.status}</span>
              <span>{camera.fps} FPS • {camera.peopleCount} ppl</span>
            </div>
          </div>
        </MarkerTooltip>
      )}

      {showPopup && (
        <MarkerPopup offset={14}>
          <div className="min-w-56 p-2 space-y-2.5 text-xs">
            {/* Header */}
            <div className="flex items-start justify-between gap-2 border-b pb-1.5">
              <div>
                <p className="font-semibold text-foreground text-xs leading-snug">{camera.name}</p>
                <p className="text-[10px] font-mono text-muted-foreground uppercase">{camera.id}</p>
              </div>
              <Badge
                variant="outline"
                className={cn('text-[9px] font-mono uppercase px-1.5 py-0 border-current', statusText)}
              >
                {camera.status}
              </Badge>
            </div>

            {/* Telemetry Stats */}
            <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
              <div className="space-y-0.5">
                <span className="text-[9px] uppercase font-mono block">Zone & Sector</span>
                <span className="text-foreground font-medium text-[10px] truncate block">{camera.zone}</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[9px] uppercase font-mono block">Resolution</span>
                <span className="text-foreground font-mono text-[10px] block">{camera.resolution}</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[9px] uppercase font-mono flex items-center gap-1">
                  <Users className="h-2.5 w-2.5" /> People Count
                </span>
                <span className="text-foreground font-semibold font-mono text-xs block">
                  {camera.peopleCount}
                </span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[9px] uppercase font-mono flex items-center gap-1">
                  <Activity className="h-2.5 w-2.5" /> Framerate
                </span>
                <span className="text-foreground font-semibold font-mono text-xs block">
                  {camera.fps} FPS
                </span>
              </div>
            </div>

            {/* Active detection indicator */}
            {hasActiveDetections && (
              <div className="rounded bg-blue-500/10 border border-blue-500/30 p-1.5 flex items-center justify-between text-[10px] text-blue-500 font-mono">
                <span className="flex items-center gap-1">
                  <Radio className="h-3 w-3 animate-pulse" /> Active Re-ID Tracks:
                </span>
                <span className="font-bold">{camera.activeDetections} Detected</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-1.5 pt-1 border-t">
              <Button
                variant="default"
                size="sm"
                className="h-7 flex-1 text-[10px] gap-1 px-2"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenStream?.(camera);
                }}
              >
                <Play className="h-3 w-3" /> Live Stream
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[10px] gap-1 px-2"
                onClick={(e) => {
                  e.stopPropagation();
                  onTrackHere?.(camera);
                }}
              >
                <Eye className="h-3 w-3" /> Track
              </Button>
            </div>
          </div>
        </MarkerPopup>
      )}
    </MapMarker>
  );
}
