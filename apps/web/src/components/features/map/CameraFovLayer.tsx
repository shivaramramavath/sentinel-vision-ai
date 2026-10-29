'use client';

import React, { useMemo } from 'react';
import { Camera } from '@/types';
import { MapGeoJSON } from '@/components/ui/map';
import { getCameraCoords } from './CameraMarker';
import type { FeatureCollection, Polygon } from 'geojson';

export interface CameraFovLayerProps {
  cameras: Camera[];
  selectedCameraId?: string;
  visibleOnlySelected?: boolean;
  opacity?: number;
}

/**
 * Calculates a GeoJSON polygon representing the camera field-of-view (FOV) cone.
 * Takes camera position, heading (0-360°), field of view angle, and optical range in meters.
 */
function createFovConePolygon(
  lng: number,
  lat: number,
  headingDeg: number,
  fovDeg: number,
  rangeMeters: number,
  steps = 12,
): [number, number][] {
  const DEG2RAD = Math.PI / 180;
  const headingRad = headingDeg * DEG2RAD;
  const halfFovRad = (fovDeg / 2) * DEG2RAD;
  const startRad = headingRad - halfFovRad;
  const endRad = headingRad + halfFovRad;

  const metersPerDegLat = 111320;
  const metersPerDegLng = 111320 * Math.cos(lat * DEG2RAD);

  const ring: [number, number][] = [[lng, lat]];

  for (let i = 0; i <= steps; i++) {
    const angle = startRad + (i / steps) * (endRad - startRad);
    // Heading 0 is North (+lat), 90 is East (+lng)
    const dLat = (rangeMeters * Math.cos(angle)) / metersPerDegLat;
    const dLng = (rangeMeters * Math.sin(angle)) / metersPerDegLng;
    ring.push([Number((lng + dLng).toFixed(6)), Number((lat + dLat).toFixed(6))]);
  }

  // Close back to the camera location
  ring.push([lng, lat]);
  return ring;
}

/**
 * Renders GeoJSON FOV optical cones for cameras to visualize coverage headings,
 * dead zones, and optical surveillance overlaps.
 */
export function CameraFovLayer({
  cameras,
  selectedCameraId,
  visibleOnlySelected = false,
  opacity = 0.15,
}: CameraFovLayerProps) {
  const fovGeoJson = useMemo<FeatureCollection<Polygon>>(() => {
    const targets = visibleOnlySelected
      ? cameras.filter((c) => c.id === selectedCameraId)
      : cameras;

    const features = targets
      .filter((cam) => cam.status !== 'offline')
      .map((cam) => {
        const [lng, lat] = getCameraCoords(cam);
        const heading = cam.heading ?? 0;
        const fov = cam.fovDegrees ?? 75;
        const range = cam.range ?? 35;
        const isSelected = cam.id === selectedCameraId;

        const coordinates = [createFovConePolygon(lng, lat, heading, fov, range)];

        return {
          type: 'Feature' as const,
          id: `fov_${cam.id}`,
          geometry: {
            type: 'Polygon' as const,
            coordinates,
          },
          properties: {
            cameraId: cam.id,
            cameraName: cam.name,
            isSelected,
            activeTrack: (cam.activeDetections ?? 0) > 0,
          },
        };
      });

    return {
      type: 'FeatureCollection',
      features,
    };
  }, [cameras, selectedCameraId, visibleOnlySelected]);

  if (!fovGeoJson.features.length) return null;

  return (
    <MapGeoJSON
      id="sentinel-camera-fov"
      data={fovGeoJson}
      fillPaint={{
        'fill-color': '#3b82f6',
        'fill-opacity': opacity,
      }}
      linePaint={{
        'line-color': '#3b82f6',
        'line-width': 1.2,
        'line-opacity': 0.45,
      }}
    />
  );
}
