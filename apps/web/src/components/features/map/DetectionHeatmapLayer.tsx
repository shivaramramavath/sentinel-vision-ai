'use client';

import { useEffect, useId, useMemo } from 'react';
import { Camera } from '@/types';
import { useMap } from '@/components/ui/map';
import { getCameraCoords } from './CameraMarker';
import type { FeatureCollection, Point } from 'geojson';

export interface DetectionHeatmapLayerProps {
  cameras: Camera[];
  opacity?: number;
  maxZoom?: number;
}

const HEATMAP_COLORS = [
  '#fff7bc',
  '#fee391',
  '#fec44f',
  '#fe9929',
  '#d7301f',
];

/**
 * Detection Density Heatmap Layer adapted from @mapcn/heatmap.
 * Renders detection activity density with zoom-dependent heat radius and smooth color falloff.
 */
export function DetectionHeatmapLayer({
  cameras,
  opacity = 0.75,
  maxZoom = 18,
}: DetectionHeatmapLayerProps) {
  const { map, isLoaded } = useMap();
  const id = useId().replace(/:/g, '_');
  const sourceId = `sentinel-heatmap-src-${id}`;
  const heatLayerId = `sentinel-heatmap-layer-${id}`;

  const geoJsonData = useMemo<FeatureCollection<Point>>(() => {
    return {
      type: 'FeatureCollection',
      features: cameras
        .filter((c) => (c.peopleCount > 0 || (c.activeDetections ?? 0) > 0))
        .map((cam) => {
          const [lng, lat] = getCameraCoords(cam);
          const weight = Math.min(1.0, ((cam.peopleCount || 0) + (cam.activeDetections || 0) * 5) / 40);
          return {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [lng, lat],
            },
            properties: {
              mag: weight,
            },
          };
        }),
    };
  }, [cameras]);

  useEffect(() => {
    if (!map || !isLoaded) return;

    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, {
        type: 'geojson',
        data: geoJsonData,
      });
    } else {
      const src = map.getSource(sourceId) as any;
      if (src && typeof src.setData === 'function') {
        src.setData(geoJsonData);
      }
    }

    if (!map.getLayer(heatLayerId)) {
      map.addLayer({
        id: heatLayerId,
        type: 'heatmap',
        source: sourceId,
        maxzoom: maxZoom,
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'mag'], 0, 0, 1, 1],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 11, 0.5, 17, 1.8],
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0,
            'rgba(59, 130, 246, 0)',
            0.2,
            HEATMAP_COLORS[0],
            0.4,
            HEATMAP_COLORS[1],
            0.6,
            HEATMAP_COLORS[2],
            0.8,
            HEATMAP_COLORS[3],
            1.0,
            HEATMAP_COLORS[4],
          ],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 10, 12, 17, 45],
          'heatmap-opacity': opacity,
        },
      });
    }

    return () => {
      try {
        if (map.getLayer(heatLayerId)) map.removeLayer(heatLayerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      } catch {
        // ignore on cleanup
      }
    };
  }, [map, isLoaded, sourceId, heatLayerId, geoJsonData, opacity, maxZoom]);

  return null;
}
