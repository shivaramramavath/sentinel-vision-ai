'use client';

import React, { useMemo } from 'react';
import { Camera, CameraTopologyTransition } from '@/types';
import { MapGeoJSON, MapArc, MapArcDatum } from '@/components/ui/map';
import { getCameraCoords } from './CameraMarker';
import type { FeatureCollection, LineString } from 'geojson';

export interface TopologyLayerProps {
  cameras: Camera[];
  transitions: CameraTopologyTransition[];
  mode?: 'lines' | 'arcs';
  color?: string;
  width?: number;
  opacity?: number;
  selectedTransition?: CameraTopologyTransition | null;
  onSelectTransition?: (transition: CameraTopologyTransition) => void;
}

/**
 * Camera Topology Spatial Transition Graph.
 * Visualizes permissible physical pathways between CCTV surveillance nodes.
 * Lines or arcs indicate calibrated travel bounds (minTravelSec to maxTravelSec).
 */
export function TopologyLayer({
  cameras,
  transitions,
  mode = 'lines',
  color = '#8b5cf6',
  width = 2,
  opacity = 0.6,
  selectedTransition,
  onSelectTransition,
}: TopologyLayerProps) {
  // Build lookup map for fast camera coordinate resolution
  const cameraCoordMap = useMemo(() => {
    const map = new Map<string, [number, number]>();
    cameras.forEach((cam) => {
      map.set(cam.id, getCameraCoords(cam));
    });
    return map;
  }, [cameras]);

  // Arcs representation for MapArc
  const arcData = useMemo<MapArcDatum[]>(() => {
    if (mode !== 'arcs') return [];
    const items: MapArcDatum[] = [];

    transitions.forEach((t, idx) => {
      const fromCoords = cameraCoordMap.get(t.fromCamera);
      const toCoords = cameraCoordMap.get(t.toCamera);
      if (fromCoords && toCoords) {
        items.push({
          id: `arc_${t.fromCamera}_${t.toCamera}_${idx}`,
          from: fromCoords,
          to: toCoords,
        });
      }
    });

    return items;
  }, [transitions, cameraCoordMap, mode]);

  // GeoJSON LineStrings for crisp high-performance lines
  const linesGeoJson = useMemo<FeatureCollection<LineString>>(() => {
    if (mode !== 'lines') return { type: 'FeatureCollection', features: [] };

    const features = transitions
      .map((t, idx) => {
        const fromCoords = cameraCoordMap.get(t.fromCamera);
        const toCoords = cameraCoordMap.get(t.toCamera);
        if (!fromCoords || !toCoords) return null;

        const isSelected =
          selectedTransition?.fromCamera === t.fromCamera &&
          selectedTransition?.toCamera === t.toCamera;

        return {
          type: 'Feature' as const,
          id: `trans_${t.fromCamera}_${t.toCamera}_${idx}`,
          geometry: {
            type: 'LineString' as const,
            coordinates: [fromCoords, toCoords],
          },
          properties: {
            fromCamera: t.fromCamera,
            toCamera: t.toCamera,
            minTravelSec: t.minTravelSec,
            maxTravelSec: t.maxTravelSec,
            distanceMeters: t.distanceMeters ?? 0,
            isSelected,
          },
        };
      })
      .filter(Boolean) as GeoJSON.Feature<LineString>[];

    return {
      type: 'FeatureCollection',
      features,
    };
  }, [transitions, cameraCoordMap, mode, selectedTransition]);

  if (mode === 'arcs') {
    return (
      <MapArc
        data={arcData}
        curvature={0.25}
        paint={{
          'line-color': color,
          'line-width': width,
          'line-opacity': opacity,
        }}
      />
    );
  }

  if (!linesGeoJson.features.length) return null;

  return (
    <MapGeoJSON
      id="sentinel-camera-topology"
      data={linesGeoJson}
      linePaint={{
        'line-color': [
          'case',
          ['boolean', ['get', 'isSelected'], false],
          '#a855f7',
          color,
        ],
        'line-width': [
          'case',
          ['boolean', ['get', 'isSelected'], false],
          width + 2,
          width,
        ],
        'line-opacity': opacity,
        'line-dasharray': [2, 1.5],
      }}
      onClick={(e) => {
        const props = e.feature?.properties;
        if (props && onSelectTransition) {
          const found = transitions.find(
            (t) => t.fromCamera === props.fromCamera && t.toCamera === props.toCamera,
          );
          if (found) onSelectTransition(found);
        }
      }}
    />
  );
}
