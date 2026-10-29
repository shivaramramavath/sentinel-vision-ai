'use client';

import { useEffect, useId, useMemo, useRef } from 'react';
import { useMap } from '@/components/ui/map';
import { TrackUpdatedEvent } from '@sentinel/shared-types';
import type { FeatureCollection, Point } from 'geojson';
import type * as MapLibreGL from 'maplibre-gl';

export interface RealtimeTrackLayerProps {
  tracks: TrackUpdatedEvent[] | Record<string, TrackUpdatedEvent>;
  onTrackClick?: (track: TrackUpdatedEvent) => void;
}

/**
 * GPU-accelerated Realtime Track Layer for Sentinel Vision AI.
 * Renders active ByteTrack neural tracks, updating in-place on the GPU by feature ID
 * without remounting or triggering full map re-renders.
 */
export function RealtimeTrackLayer({ tracks, onTrackClick }: RealtimeTrackLayerProps) {
  const { map, isLoaded } = useMap();
  const id = useId().replace(/:/g, '-');
  const sourceId = `track-source-${id}`;
  const layerId = `track-circles-${id}`;
  const pulseLayerId = `track-pulses-${id}`;

  const trackList = useMemo(() => {
    if (Array.isArray(tracks)) return tracks;
    return Object.values(tracks);
  }, [tracks]);

  // Construct GeoJSON FeatureCollection with strict feature IDs
  const geojson = useMemo<FeatureCollection<Point>>(() => {
    return {
      type: 'FeatureCollection',
      features: trackList
        .filter((t) => t.coordinates && t.coordinates.length === 2)
        .map((t) => ({
          type: 'Feature',
          id: String(t.trackId),
          geometry: {
            type: 'Point',
            coordinates: t.coordinates!,
          },
          properties: {
            trackId: String(t.trackId),
            cameraId: t.cameraId,
            caseId: t.caseId || '',
            ts: t.ts,
            hasCase: Boolean(t.caseId),
          },
        })),
    };
  }, [trackList]);

  const onTrackClickRef = useRef(onTrackClick);
  onTrackClickRef.current = onTrackClick;

  const trackListRef = useRef(trackList);
  trackListRef.current = trackList;

  // Mount source & layers once
  useEffect(() => {
    if (!isLoaded || !map) return;

    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, {
        type: 'geojson',
        data: geojson,
        promoteId: 'trackId',
      });
    }

    // Outer pulse ring for active tracks
    if (!map.getLayer(pulseLayerId)) {
      map.addLayer({
        id: pulseLayerId,
        type: 'circle',
        source: sourceId,
        paint: {
          'circle-color': '#3b82f6',
          'circle-radius': 14,
          'circle-opacity': 0.35,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#3b82f6',
        },
      });
    }

    // Core track circle
    if (!map.getLayer(layerId)) {
      map.addLayer({
        id: layerId,
        type: 'circle',
        source: sourceId,
        paint: {
          'circle-color': [
            'case',
            ['boolean', ['get', 'hasCase'], false],
            '#3b82f6', // Target case person (Blue)
            '#06b6d4', // Regular pedestrian track (Cyan)
          ],
          'circle-radius': 7,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.95,
        },
      });
    }

    const handleClick = (e: MapLibreGL.MapLayerMouseEvent) => {
      const feat = e.features?.[0];
      const clickedId = feat?.properties?.trackId;
      if (clickedId) {
        const found = trackListRef.current.find((t) => String(t.trackId) === String(clickedId));
        if (found) onTrackClickRef.current?.(found);
      }
    };

    map.on('click', layerId, handleClick);

    return () => {
      try {
        map.off('click', layerId, handleClick);
        if (map.getLayer(layerId)) map.removeLayer(layerId);
        if (map.getLayer(pulseLayerId)) map.removeLayer(pulseLayerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      } catch {
        // ignore on unmount
      }
    };
  }, [isLoaded, map, sourceId, layerId, pulseLayerId]);

  // Update source data in place on GPU by feature ID without re-mounting
  useEffect(() => {
    if (!isLoaded || !map) return;
    const source = map.getSource(sourceId) as MapLibreGL.GeoJSONSource | undefined;
    if (source) {
      source.setData(geojson);
    }
  }, [isLoaded, map, sourceId, geojson]);

  return null;
}
