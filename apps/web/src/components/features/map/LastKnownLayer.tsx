'use client';

import React, { useMemo } from 'react';
import { Camera } from '@/types';
import { MapMarker, MarkerContent, MarkerPopup, MapGeoJSON } from '@/components/ui/map';
import { getCameraCoords } from './CameraMarker';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Clock, MapPin, Footprints, ShieldAlert } from 'lucide-react';
import type { FeatureCollection, Polygon } from 'geojson';

export interface LastKnownLayerProps {
  center: [number, number]; // [lng, lat]
  lastSeenTimestamp: string;
  locationName?: string;
  walkingSpeedMps?: number; // meters per second, default 1.4 m/s
  maxRadiusMeters?: number; // max cap, default 1500m
  cameras?: Camera[];
  onSuggestedCameraClick?: (camera: Camera) => void;
}

/**
 * Calculates geodesic distance in meters between two [lng, lat] coordinates.
 */
function getDistanceMeters(coord1: [number, number], coord2: [number, number]): number {
  const DEG2RAD = Math.PI / 180;
  const lat1 = coord1[1] * DEG2RAD;
  const lat2 = coord2[1] * DEG2RAD;
  const dLat = (coord2[1] - coord1[1]) * DEG2RAD;
  const dLng = (coord2[0] - coord1[0]) * DEG2RAD;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371000 * c; // Earth radius in meters
}

/**
 * Generates a GeoJSON Polygon circle around [lng, lat] with radius in meters.
 */
function createCirclePolygon(
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

/**
 * Last Known Location & Reachable Area Dispersion Layer.
 * Adheres strictly to Sentinel Vision location semantics:
 * - We never know a person's exact position.
 * - Draws an estimated reachable area circle: r = walking_speed (1.4 m/s) * elapsed_seconds, capped by maxRadius.
 * - Rendered as a translucent amber GeoJSON polygon labeled "Estimated reachable area (not a confirmed position)".
 * - Identifies and highlights suggested cameras inside the reachable area.
 */
export function LastKnownLayer({
  center,
  lastSeenTimestamp,
  locationName = 'Last Sighting Location',
  walkingSpeedMps = 1.4,
  maxRadiusMeters = 1500,
  cameras = [],
  onSuggestedCameraClick,
}: LastKnownLayerProps) {
  // Compute elapsed time in seconds and growing radius
  const { elapsedSeconds, radiusMeters, formattedElapsed } = useMemo(() => {
    const lastSeen = new Date(lastSeenTimestamp).getTime();
    const now = Date.now();
    const diffSec = Math.max(60, Math.floor((now - lastSeen) / 1000));

    // r = speed * seconds, capped by max
    const calculatedRadius = Math.min(maxRadiusMeters, Math.max(80, Math.round(diffSec * walkingSpeedMps)));

    const minutes = Math.floor(diffSec / 60);
    const hours = Math.floor(minutes / 60);
    const remainingMins = minutes % 60;
    const formatted = hours > 0 ? `${hours}h ${remainingMins}m ago` : `${minutes}m ago`;

    return {
      elapsedSeconds: diffSec,
      radiusMeters: calculatedRadius,
      formattedElapsed: formatted,
    };
  }, [lastSeenTimestamp, walkingSpeedMps, maxRadiusMeters]);

  // Construct GeoJSON Polygon circle
  const reachableCircleGeoJson = useMemo<FeatureCollection<Polygon>>(() => {
    const coordinates = [createCirclePolygon(center[0], center[1], radiusMeters)];
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: 'estimated-reachable-area',
          geometry: {
            type: 'Polygon',
            coordinates,
          },
          properties: {
            radiusMeters,
            elapsedSeconds,
            walkingSpeedMps,
          },
        },
      ],
    };
  }, [center, radiusMeters, elapsedSeconds, walkingSpeedMps]);

  // Find cameras inside the reachable area
  const suggestedCameras = useMemo(() => {
    return cameras.filter((cam) => {
      const coords = getCameraCoords(cam);
      const dist = getDistanceMeters(center, coords);
      return dist <= radiusMeters;
    });
  }, [cameras, center, radiusMeters]);

  return (
    <>
      {/* 1. Translucent Amber GeoJSON Reachable Area Polygon */}
      <MapGeoJSON
        id="sentinel-reachable-area-circle"
        data={reachableCircleGeoJson}
        fillPaint={{
          'fill-color': '#f59e0b',
          'fill-opacity': 0.12,
        }}
        linePaint={{
          'line-color': '#f59e0b',
          'line-width': 2,
          'line-opacity': 0.7,
          'line-dasharray': [3, 2],
        }}
      />

      {/* 2. Highlight Suggested Cameras Inside the Search Area */}
      {suggestedCameras.map((cam) => {
        const [lng, lat] = getCameraCoords(cam);
        return (
          <MapMarker
            key={`suggested_${cam.id}`}
            longitude={lng}
            latitude={lat}
            onClick={() => onSuggestedCameraClick?.(cam)}
          >
            <MarkerContent>
              <div className="relative group cursor-pointer" title={`Suggested Camera: ${cam.name}`}>
                <span className="absolute -inset-2 animate-ping rounded-full bg-amber-500/30" />
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-black font-mono text-[9px] font-bold border-2 border-background shadow-md">
                  ★
                </div>
              </div>
            </MarkerContent>
          </MapMarker>
        );
      })}

      {/* 3. Last Known Location Center Marker */}
      <MapMarker longitude={center[0]} latitude={center[1]}>
        <MarkerContent>
          <div className="relative flex items-center justify-center group cursor-pointer">
            <span className="absolute -inset-3 animate-ping rounded-full bg-amber-500/40" />
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 text-black border-2 border-white shadow-xl">
              <MapPin className="h-4 w-4" />
            </div>
          </div>
        </MarkerContent>

        <MarkerPopup offset={16}>
          <div className="min-w-64 p-2.5 space-y-2 text-xs">
            <div className="flex items-start justify-between gap-2 border-b pb-1.5">
              <div>
                <p className="font-semibold text-foreground text-xs leading-tight">
                  Last Known Location
                </p>
                <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                  {locationName}
                </p>
              </div>
              <Badge variant="outline" className="text-[9px] font-mono text-amber-500 border-amber-500/40">
                {formattedElapsed}
              </Badge>
            </div>

            {/* Compliance Disclaimer (Mandatory) */}
            <div className="rounded bg-amber-500/10 border border-amber-500/30 p-2 text-[10px] text-amber-600 dark:text-amber-400 space-y-1">
              <div className="font-semibold flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                Estimated Reachable Area
              </div>
              <p className="leading-snug">
                Not a confirmed person position. Dispersion boundary assumes ~{walkingSpeedMps} m/s walking speed over {formattedElapsed}.
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-muted-foreground pt-1 border-t">
              <div>
                <span className="text-[9px] uppercase block">Search Radius</span>
                <span className="text-foreground font-semibold">
                  {radiusMeters >= 1000 ? `${(radiusMeters / 1000).toFixed(1)} km` : `${radiusMeters} m`}
                </span>
              </div>
              <div>
                <span className="text-[9px] uppercase block">Suggested Cameras</span>
                <span className="text-foreground font-semibold text-amber-500">
                  {suggestedCameras.length} Nodes Inside
                </span>
              </div>
            </div>
          </div>
        </MarkerPopup>
      </MapMarker>
    </>
  );
}
