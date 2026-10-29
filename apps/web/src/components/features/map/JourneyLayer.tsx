'use client';

import React, { useMemo } from 'react';
import { Journey, JourneyNode } from '@/types';
import {
  MapMarker,
  MarkerContent,
  MarkerPopup,
  MapRoute,
  RouteProgress,
  RouteMarker,
  MapGeoJSON,
} from '@/components/ui/map';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Shield, Clock, Eye, CheckCircle2, AlertTriangle, ScanFace, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FeatureCollection, LineString } from 'geojson';

export interface JourneyLayerProps {
  journey: Journey;
  selectedNodeIndex?: number;
  hoveredNodeIndex?: number | null;
  onSelectNode?: (index: number, node: JourneyNode) => void;
  onHoverNode?: (index: number | null) => void;
  playbackProgress?: number; // 0.0 to 1.0 (null/undefined when playback is inactive)
  showPopups?: boolean;
}

/**
 * Sequential Journey Route & Multi-Camera Trajectory Layer.
 * Renders:
 * - Numbered markers 1..N with appearance similarity & status chips
 * - Solid lines for human-verified hops
 * - Amber dashed lines for unconfirmed/possible hops
 * - Interactive playback marker moving along the route via RouteProgress & RouteMarker
 */
export function JourneyLayer({
  journey,
  selectedNodeIndex,
  hoveredNodeIndex,
  onSelectNode,
  onHoverNode,
  playbackProgress,
  showPopups = true,
}: JourneyLayerProps) {
  const sequence = journey.cameraSequence;

  // Strict [longitude, latitude] coordinates for all hops
  const coordinates = useMemo<[number, number][]>(() => {
    return sequence.map((node) => [node.coords[1], node.coords[0]]);
  }, [sequence]);

  // Construct segmented GeoJSON for verified (solid) vs possible (amber dashed) hops
  const segmentsGeoJson = useMemo<FeatureCollection<LineString>>(() => {
    const features: GeoJSON.Feature<LineString>[] = [];

    for (let i = 0; i < sequence.length - 1; i++) {
      const fromNode = sequence[i];
      const toNode = sequence[i + 1];
      const isVerifiedHop = Boolean(toNode.verified);

      features.push({
        type: 'Feature',
        id: `hop_${fromNode.sightingId}_${toNode.sightingId}`,
        geometry: {
          type: 'LineString',
          coordinates: [
            [fromNode.coords[1], fromNode.coords[0]],
            [toNode.coords[1], toNode.coords[0]],
          ],
        },
        properties: {
          hopIndex: i + 1,
          isVerified: isVerifiedHop,
          fromName: fromNode.cameraName,
          toName: toNode.cameraName,
        },
      });
    }

    return {
      type: 'FeatureCollection',
      features,
    };
  }, [sequence]);

  return (
    <>
      {/* 1. Underlying Route Lines: Verified (solid) vs Possible (amber dashed) */}
      <MapGeoJSON
        id="sentinel-journey-segments"
        data={segmentsGeoJson}
        linePaint={{
          'line-color': [
            'case',
            ['boolean', ['get', 'isVerified'], false],
            '#3b82f6', // Solid Blue for verified
            '#f59e0b', // Amber for possible
          ],
          'line-width': 3.5,
          'line-opacity': 0.85,
          'line-dasharray': [
            'case',
            ['boolean', ['get', 'isVerified'], false],
            ['literal', [1, 0]], // Solid
            ['literal', [3, 2]], // Dashed
          ],
        }}
      />

      {/* 2. Playback Animation Route (when playbackProgress is provided) */}
      {typeof playbackProgress === 'number' && coordinates.length >= 2 && (
        <MapRoute
          id="journey-playback-tracer"
          coordinates={coordinates}
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
                <span className="absolute -inset-2 animate-ping rounded-full bg-blue-500/50" />
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg border-2 border-white">
                  <div className="h-2 w-2 rounded-full bg-white" />
                </div>
              </div>
            </MarkerContent>
          </RouteMarker>
        </MapRoute>
      )}

      {/* 3. Numbered Sequential Camera Markers (1..N) */}
      {sequence.map((node, index) => {
        const isSelected = selectedNodeIndex === index;
        const isHovered = hoveredNodeIndex === index;
        const isVerified = Boolean(node.verified);
        const similarityPct = Math.round((node.appearanceSimilarity ?? 0.75) * 100);

        return (
          <MapMarker
            key={node.sightingId}
            longitude={node.coords[1]}
            latitude={node.coords[0]}
            onClick={() => onSelectNode?.(index, node)}
          >
            <MarkerContent>
              <div
                className="relative group cursor-pointer"
                onMouseEnter={() => onHoverNode?.(index)}
                onMouseLeave={() => onHoverNode?.(null)}
              >
                {/* Active Highlight Ring on Hover/Select */}
                {(isSelected || isHovered) && (
                  <span className="absolute -inset-1.5 animate-pulse rounded-full bg-primary/30" />
                )}

                <div
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-mono font-bold shadow-md transition-all duration-200',
                    isSelected
                      ? 'scale-125 ring-4 ring-primary/40 z-30'
                      : isHovered
                      ? 'scale-115 z-20'
                      : 'z-10',
                    isVerified
                      ? 'bg-blue-600 text-white border-white'
                      : 'bg-zinc-900 text-amber-400 border-amber-500 border-dashed',
                  )}
                >
                  {index + 1}
                </div>
              </div>
            </MarkerContent>

            {showPopups && (
              <MarkerPopup offset={14}>
                <div className="min-w-60 p-2.5 space-y-2 text-xs">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2 border-b pb-1.5">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded font-bold">
                          HOP #{index + 1}
                        </span>
                        <span className="font-semibold text-foreground truncate max-w-[140px]">
                          {node.cameraName}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono block mt-0.5">
                        {node.zone}
                      </span>
                    </div>

                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[9px] font-mono uppercase px-1.5 py-0',
                        isVerified
                          ? 'text-blue-500 border-blue-500/40 bg-blue-500/10'
                          : 'text-amber-500 border-amber-500/40 bg-amber-500/10',
                      )}
                    >
                      {isVerified ? 'Confirmed' : 'Possible'}
                    </Badge>
                  </div>

                  {/* Time & Dwell */}
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(node.timestamp).toLocaleTimeString()}
                    </span>
                    <span>Dwell: {node.dwellTimeSeconds}s</span>
                  </div>

                  {/* Appearance Similarity */}
                  <div className="space-y-1 bg-muted/20 p-2 rounded border border-border/40">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">Appearance Similarity</span>
                      <span className="font-mono font-bold text-foreground">{similarityPct}%</span>
                    </div>
                    <Progress value={similarityPct} className="h-1.5" />
                    <div className="flex justify-between text-[9px] text-muted-foreground font-mono pt-1">
                      <span className="flex items-center gap-1">
                        <ScanFace className="h-2.5 w-2.5 text-blue-500" />
                        Face: {node.faceScore ? `${Math.round(node.faceScore * 100)}%` : 'N/A'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Layers className="h-2.5 w-2.5 text-blue-500" />
                        Re-ID: {node.reidScore ? `${Math.round(node.reidScore * 100)}%` : 'N/A'}
                      </span>
                    </div>
                  </div>

                  {/* Compliance note */}
                  <div className="text-[9px] text-muted-foreground italic leading-tight">
                    {isVerified
                      ? 'Verified by human reviewer against reference dossier.'
                      : 'Unverified sighting candidate. Requires investigator verification.'}
                  </div>
                </div>
              </MarkerPopup>
            )}
          </MapMarker>
        );
      })}
    </>
  );
}
