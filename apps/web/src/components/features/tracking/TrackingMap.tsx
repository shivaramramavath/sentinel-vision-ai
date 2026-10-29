'use client';

import React, { useMemo, useState, useRef, useEffect } from 'react';
import { DetailedJourney, DetailedHopNode } from '@/types/tracking';
import {
  SentinelMap,
  MapLegend,
} from '@/components/features/map';
import {
  MapMarker,
  MarkerContent,
  MarkerPopup,
  MapGeoJSON,
  MapRoute,
  RouteProgress,
  RouteMarker,
  MapControls,
} from '@/components/ui/map';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
import {
  Crosshair,
  Info,
  Camera,
  Layers,
  Clock,
  Footprints,
  Eye,
  ScanFace,
  HelpCircle,
  Navigation,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FeatureCollection, LineString, Polygon } from 'geojson';

export interface TrackingMapProps {
  journey: DetailedJourney;
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  hoveredIndex: number | null;
  onHoverIndex: (index: number | null) => void;
  playbackProgress?: number;
  onOpenSearchSheet?: () => void;
  className?: string;
}

/**
 * Computes circle polygon [lng, lat] vertices for Reachable Area GeoJSON
 */
function createReachableCircle(
  centerLng: number,
  centerLat: number,
  radiusMeters: number,
  steps = 48,
): [number, number][] {
  const DEG2RAD = Math.PI / 180;
  const metersPerDegLat = 111320;
  const metersPerDegLng = 111320 * Math.cos(centerLat * DEG2RAD);

  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * (2 * Math.PI);
    const dLat = (radiusMeters * Math.cos(angle)) / metersPerDegLat;
    const dLng = (radiusMeters * Math.sin(angle)) / metersPerDegLng;
    ring.push([Number((centerLng + dLng).toFixed(6)), Number((centerLat + dLat).toFixed(6))]);
  }
  return ring;
}

export function TrackingMap({
  journey,
  selectedIndex,
  onSelectIndex,
  hoveredIndex,
  onHoverIndex,
  playbackProgress,
  onOpenSearchSheet,
  className,
}: TrackingMapProps) {
  const [showRejected, setShowRejected] = useState(false);
  const [showLegend, setShowLegend] = useState(false);

  const hops = useMemo(() => {
    if (showRejected) return journey.hops;
    return journey.hops.filter((h) => h.status !== 'rejected');
  }, [journey.hops, showRejected]);

  // Map center from selected or first hop [lng, lat]
  const mapCenter: [number, number] = useMemo(() => {
    if (hops[selectedIndex]) {
      return [hops[selectedIndex].coords[1], hops[selectedIndex].coords[0]];
    }
    if (hops[0]) {
      return [hops[0].coords[1], hops[0].coords[0]];
    }
    return [-74.006, 40.7128];
  }, [hops, selectedIndex]);

  // Route coordinates for playback tracer: [[lng, lat]]
  const routeCoordinates = useMemo<[number, number][]>(() => {
    return hops.map((h) => [h.coords[1], h.coords[0]]);
  }, [hops]);

  // Construct segmented GeoJSON lines:
  // - Solid Blue (#3b82f6): BOTH end hops are confirmed
  // - Grey Dotted (#94a3b8): Unobserved gap (gapMinutes exists or elapsed > 1200s)
  // - Dashed Amber (#f59e0b): Either end is possible/unverified
  const segmentsGeoJson = useMemo<FeatureCollection<LineString>>(() => {
    const features: GeoJSON.Feature<LineString>[] = [];

    for (let i = 0; i < hops.length - 1; i++) {
      const fromNode = hops[i];
      const toNode = hops[i + 1];

      const bothConfirmed = fromNode.status === 'confirmed' && toNode.status === 'confirmed';
      const isGap = Boolean(toNode.transition.gapMinutes || toNode.transition.plausibility === 'unobserved_gap');

      const styleType = bothConfirmed ? 'confirmed' : isGap ? 'gap' : 'possible';

      features.push({
        type: 'Feature',
        id: `segment_${fromNode.sightingId}_${toNode.sightingId}`,
        geometry: {
          type: 'LineString',
          coordinates: [
            [fromNode.coords[1], fromNode.coords[0]],
            [toNode.coords[1], toNode.coords[0]],
          ],
        },
        properties: {
          hopIndex: i + 1,
          styleType,
          fromName: fromNode.cameraName,
          toName: toNode.cameraName,
        },
      });
    }

    return {
      type: 'FeatureCollection',
      features,
    };
  }, [hops]);

  // Reachable Area Circle GeoJSON (Drawn after the last hop)
  const reachableAreaGeoJson = useMemo<FeatureCollection<Polygon>>(() => {
    const lastHop = hops[hops.length - 1];
    if (!lastHop) {
      return { type: 'FeatureCollection', features: [] };
    }

    const ring = createReachableCircle(
      lastHop.coords[1],
      lastHop.coords[0],
      journey.reachableArea.radiusMeters,
    );

    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: `reachable_area_${journey.caseId}`,
          geometry: {
            type: 'Polygon',
            coordinates: [ring],
          },
          properties: {
            radiusMeters: journey.reachableArea.radiusMeters,
            label: journey.reachableArea.label,
          },
        },
      ],
    };
  }, [hops, journey.caseId, journey.reachableArea.radiusMeters, journey.reachableArea.label]);

  return (
    <div className={cn('relative w-full h-full min-h-[440px] rounded-t-lg overflow-hidden', className)}>
      {/* Top Map Header Strip */}
      <div className="absolute top-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto bg-background/85 px-2.5 py-1 rounded-md border backdrop-blur-md shadow-xs">
          <span className="text-xs font-bold text-foreground">
            {journey.label}
          </span>
          <span className="text-[10px] text-muted-foreground font-mono">
            ({hops.length} Hops Displayed)
          </span>
        </div>

        {/* Legend Popover & Rejected Toggle */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Toggle Show Rejected */}
          <div className="flex items-center gap-1.5 rounded-md border bg-background/85 px-2 py-1 text-[10px] font-mono backdrop-blur-md">
            <span>Show Rejected:</span>
            <Switch
              checked={showRejected}
              onCheckedChange={setShowRejected}
              className="scale-75"
            />
          </div>

          {/* Legend Popover */}
          <Popover open={showLegend} onOpenChange={setShowLegend}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs gap-1 bg-background/85 backdrop-blur-md font-mono"
              >
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Legend</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent side="bottom" align="end" className="w-64 p-3 space-y-2 text-xs font-mono">
              <div className="font-bold text-foreground text-xs pb-1 border-b">
                Map Symbology Legend
              </div>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full bg-blue-600 border border-white text-white text-[9px] font-bold flex items-center justify-center">
                    1
                  </span>
                  <span>Confirmed Hop (Filled Blue)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full bg-zinc-900 border border-amber-500 border-dashed text-amber-400 text-[9px] font-bold flex items-center justify-center">
                    2
                  </span>
                  <span>Possible Hop (Dashed Amber)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-0.5 w-5 bg-blue-500" />
                  <span>Verified Segment (Solid Blue)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-0.5 w-5 border-t-2 border-dashed border-amber-500" />
                  <span>Unverified Segment (Dashed)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-0.5 w-5 border-t-2 border-dotted border-zinc-400" />
                  <span>Unobserved Gap (Grey Dotted)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 rounded-full border border-dashed border-cyan-400 bg-cyan-500/20" />
                  <span>Reachable Area Ring</span>
                </div>
                <div className="flex items-center gap-2">
                  <Camera className="h-3.5 w-3.5 text-cyan-400" />
                  <span>Suggested Next Camera</span>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <SentinelMap
        center={mapCenter}
        zoom={15.2}
        controlsPosition="bottom-right"
        className="h-full w-full"
      >
        {/* 1. Reachable Area Polygon Layer (Drawn around last sighting) */}
        <MapGeoJSON
          id="sentinel-reachable-area"
          data={reachableAreaGeoJson}
          fillPaint={{
            'fill-color': '#06b6d4',
            'fill-opacity': 0.12,
          }}
          linePaint={{
            'line-color': '#06b6d4',
            'line-width': 2,
            'line-dasharray': [4, 2],
            'line-opacity': 0.8,
          }}
        />

        {/* 2. Segments Layer: Solid Blue vs Dashed Amber vs Grey Dotted */}
        <MapGeoJSON
          id="sentinel-journey-segments"
          data={segmentsGeoJson}
          linePaint={{
            'line-color': [
              'match',
              ['get', 'styleType'],
              'confirmed',
              '#3b82f6', // Solid Blue for verified
              'gap',
              '#94a3b8', // Grey Dotted for unobserved gap
              '#f59e0b', // Dashed Amber for possible
            ],
            'line-width': 3.5,
            'line-opacity': 0.85,
            'line-dasharray': [
              'match',
              ['get', 'styleType'],
              'confirmed',
              ['literal', [1, 0]], // Solid
              'gap',
              ['literal', [1, 2]], // Dotted
              ['literal', [3, 2]], // Dashed
            ],
          }}
        />

        {/* 3. Playback Route Tracer */}
        {typeof playbackProgress === 'number' && routeCoordinates.length >= 2 && (
          <MapRoute
            id="journey-playback-tracer"
            coordinates={routeCoordinates}
            progress={playbackProgress}
            color="rgba(148, 163, 184, 0.2)"
            width={4}
            opacity={0.5}
            interactive={false}
          >
            <RouteProgress color="#3b82f6" width={4} opacity={0.95} />
            <RouteMarker at="progress">
              <MarkerContent>
                <div className="relative flex items-center justify-center">
                  <span className="absolute -inset-2.5 animate-ping rounded-full bg-cyan-400/60" />
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-500 text-black shadow-lg border-2 border-white">
                    <Navigation className="h-3 w-3 fill-current rotate-45" />
                  </div>
                </div>
              </MarkerContent>
            </RouteMarker>
          </MapRoute>
        )}

        {/* 4. Sequential Hop Numbered Markers (1..N) */}
        {hops.map((hop, idx) => {
          const isSelected = selectedIndex === idx;
          const isHovered = hoveredIndex === idx;
          const isConfirmed = hop.status === 'confirmed';
          const isRejected = hop.status === 'rejected';

          return (
            <MapMarker
              key={hop.sightingId}
              longitude={hop.coords[1]}
              latitude={hop.coords[0]}
              onClick={() => onSelectIndex(idx)}
            >
              <MarkerContent>
                <div
                  className="relative group cursor-pointer"
                  onMouseEnter={() => onHoverIndex(idx)}
                  onMouseLeave={() => onHoverIndex(null)}
                >
                  {/* Selection / Hover Glow Ring */}
                  {(isSelected || isHovered) && (
                    <span className="absolute -inset-2 animate-pulse rounded-full bg-cyan-400/40" />
                  )}

                  <div
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-mono font-bold shadow-md transition-all duration-200',
                      isSelected
                        ? 'scale-125 ring-4 ring-cyan-500/40 z-30'
                        : isHovered
                        ? 'scale-115 z-20'
                        : 'z-10',
                      isConfirmed
                        ? 'bg-blue-600 text-white border-white'
                        : isRejected
                        ? 'bg-zinc-800 text-zinc-400 border-zinc-600'
                        : 'bg-zinc-900 text-amber-400 border-amber-500 border-dashed',
                    )}
                  >
                    {hop.hopNumber}
                  </div>
                </div>
              </MarkerContent>

              <MarkerPopup offset={14}>
                <div className="min-w-56 p-2.5 space-y-2 text-xs">
                  <div className="flex items-start justify-between gap-2 border-b pb-1.5">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded font-bold">
                          HOP #{hop.hopNumber}
                        </span>
                        <span className="font-semibold text-foreground truncate max-w-[130px]">
                          {hop.cameraName}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono block mt-0.5">
                        {hop.zone}
                      </span>
                    </div>

                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[9px] font-mono uppercase px-1.5 py-0',
                        isConfirmed
                          ? 'text-blue-400 border-blue-500/40 bg-blue-950/20'
                          : 'text-amber-400 border-amber-500/40 bg-amber-950/20',
                      )}
                    >
                      {isConfirmed ? 'Confirmed' : 'Possible'}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(hop.timestamp).toLocaleTimeString()}
                    </span>
                    <span>Dwell: {hop.dwellTimeSeconds}s</span>
                  </div>

                  <div className="space-y-1 bg-muted/20 p-2 rounded border border-border/40">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">Fused Evidence</span>
                      <span className="font-mono font-bold text-foreground">
                        {Math.round(hop.scores.fused * 100)}%
                      </span>
                    </div>
                    <Progress value={hop.scores.fused * 100} className="h-1.5" />
                  </div>
                </div>
              </MarkerPopup>
            </MapMarker>
          );
        })}

        {/* 5. Suggested Cameras Markers Around Reachable Area */}
        {journey.suggestedCameras.map((cam) => (
          <MapMarker
            key={`sugg_${cam.cameraId}`}
            longitude={cam.coords[1]}
            latitude={cam.coords[0]}
          >
            <MarkerContent>
              <div
                className="relative group cursor-pointer p-1 rounded-full border-2 border-cyan-400 bg-black/80 text-cyan-400 hover:scale-125 transition-transform shadow-md"
                title={`Suggested Camera: ${cam.name} (${cam.distanceMeters}m)`}
                onClick={onOpenSearchSheet}
              >
                <Camera className="h-3.5 w-3.5" />
              </div>
            </MarkerContent>
            <MarkerPopup offset={12}>
              <div className="p-2 text-xs font-mono space-y-1">
                <div className="font-bold text-cyan-400 text-[11px]">Suggested Next Camera</div>
                <div className="text-foreground font-semibold">{cam.name}</div>
                <div className="text-[10px] text-muted-foreground">
                  {cam.distanceMeters}m away • Arrival: {cam.expectedArrivalWindowMin}
                </div>
              </div>
            </MarkerPopup>
          </MapMarker>
        ))}
      </SentinelMap>
    </div>
  );
}
