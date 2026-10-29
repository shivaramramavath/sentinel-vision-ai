'use client';

import React, { useMemo } from 'react';
import { Camera } from '@/types';
import { CameraMarker, getCameraCoords } from './CameraMarker';
import { MapClusterLayer } from '@/components/ui/map';
import type { FeatureCollection, Point } from 'geojson';
import { CameraHealthEvent } from '@sentinel/shared-types';

export interface CameraLayerProps {
  cameras: Camera[];
  selectedCameraId?: string;
  onSelectCamera?: (camera: Camera) => void;
  onOpenStream?: (camera: Camera) => void;
  onTrackHere?: (camera: Camera) => void;
  statusFilter?: 'all' | 'live' | 'offline' | 'degraded';
  locationFilter?: string;
  floorFilter?: number | 'all';
  enableClustering?: boolean;
  clusteringThreshold?: number;
  realtimeHealth?: Record<string, CameraHealthEvent>;
  showTooltip?: boolean;
}

/**
 * High-performance Camera Layer for Sentinel Vision AI.
 * Handles rendering up to hundreds of edge cameras with seamless toggle between
 * rich DOM markers and GPU-accelerated GeoJSON point clustering (via MapClusterLayer).
 */
export function CameraLayer({
  cameras,
  selectedCameraId,
  onSelectCamera,
  onOpenStream,
  onTrackHere,
  statusFilter = 'all',
  locationFilter,
  floorFilter = 'all',
  enableClustering,
  clusteringThreshold = 80,
  realtimeHealth,
  showTooltip = true,
}: CameraLayerProps) {
  // Merge live telemetry updates by camera id
  const mergedCameras = useMemo(() => {
    if (!realtimeHealth || Object.keys(realtimeHealth).length === 0) return cameras;
    return cameras.map((c) => {
      const live = realtimeHealth[c.id];
      if (!live) return c;
      return {
        ...c,
        status: (live.status.toLowerCase() as any),
        fps: live.fps,
        peopleCount: live.peopleCount,
      };
    });
  }, [cameras, realtimeHealth]);

  // Filter cameras
  const filteredCameras = useMemo(() => {
    return mergedCameras.filter((cam) => {
      const matchStatus = statusFilter === 'all' || cam.status === statusFilter;
      const matchLocation = !locationFilter || locationFilter === 'all' || cam.locationName === locationFilter;
      const matchFloor = floorFilter === 'all' || cam.floor === floorFilter;
      return matchStatus && matchLocation && matchFloor;
    });
  }, [mergedCameras, statusFilter, locationFilter, floorFilter]);

  // Determine whether to use GPU-accelerated clustering
  const shouldUseClustering =
    enableClustering !== undefined
      ? enableClustering
      : filteredCameras.length > clusteringThreshold;

  // Convert to GeoJSON for MapClusterLayer
  const clusterData = useMemo<FeatureCollection<Point>>(() => {
    return {
      type: 'FeatureCollection',
      features: filteredCameras.map((cam) => {
        const [lng, lat] = getCameraCoords(cam);
        return {
          type: 'Feature',
          id: cam.id,
          geometry: {
            type: 'Point',
            coordinates: [lng, lat],
          },
          properties: {
            id: cam.id,
            name: cam.name,
            status: cam.status,
            peopleCount: cam.peopleCount,
            fps: cam.fps,
            zone: cam.zone,
            locationName: cam.locationName,
            activeDetections: cam.activeDetections ?? 0,
          },
        };
      }),
    };
  }, [filteredCameras]);

  if (shouldUseClustering) {
    return (
      <MapClusterLayer
        data={clusterData}
        clusterMaxZoom={16}
        clusterRadius={50}
        clusterColors={['#2563eb', '#3b82f6', '#60a5fa']}
        clusterThresholds={[10, 25]}
        pointColor="#3b82f6"
        onPointClick={(feature) => {
          const id = feature.properties?.id;
          const found = filteredCameras.find((c) => c.id === id);
          if (found) onSelectCamera?.(found);
        }}
      />
    );
  }

  return (
    <>
      {filteredCameras.map((camera) => (
        <CameraMarker
          key={camera.id}
          camera={camera}
          isSelected={camera.id === selectedCameraId}
          onClick={onSelectCamera}
          onOpenStream={onOpenStream}
          onTrackHere={onTrackHere}
          showTooltip={showTooltip}
        />
      ))}
    </>
  );
}
