'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  CameraHealthEvent,
  TrackUpdatedEvent,
  MapSightingCreatedEvent as SightingCreatedEvent,
  JourneyUpdatedEvent,
} from '@sentinel/shared-types';

export interface UseRealtimeMapSocketOptions {
  siteId?: string;
  caseId?: string;
  coalesceIntervalMs?: number; // default: 250 ms
  onCameraHealthBatch?: (updates: CameraHealthEvent[]) => void;
  onTrackUpdatedBatch?: (tracks: TrackUpdatedEvent[]) => void;
  onSightingCreated?: (sighting: SightingCreatedEvent) => void;
  onJourneyUpdated?: (journey: JourneyUpdatedEvent) => void;
}

/**
 * Socket.IO client hook that joins room subscriptions (per site and per case)
 * and coalesces high-frequency map events at 250 ms before passing to map layers,
 * enabling feature-id updates without full map re-renders.
 */
export function useRealtimeMapSocket(options: UseRealtimeMapSocketOptions = {}) {
  const {
    siteId,
    caseId,
    coalesceIntervalMs = 250,
    onCameraHealthBatch,
    onTrackUpdatedBatch,
    onSightingCreated,
    onJourneyUpdated,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [cameraHealthMap, setCameraHealthMap] = useState<Record<string, CameraHealthEvent>>({});
  const [activeTracksMap, setActiveTracksMap] = useState<Record<string, TrackUpdatedEvent>>({});
  const [recentSightings, setRecentSightings] = useState<SightingCreatedEvent[]>([]);
  const [activeJourney, setActiveJourney] = useState<JourneyUpdatedEvent | null>(null);

  const socketRef = useRef<Socket | null>(null);

  // Coalescing buffers
  const pendingCameraHealthRef = useRef<Map<string, CameraHealthEvent>>(new Map());
  const pendingTracksRef = useRef<Map<string, TrackUpdatedEvent>>(new Map());
  const pendingSightingsRef = useRef<SightingCreatedEvent[]>([]);
  const pendingJourneyRef = useRef<JourneyUpdatedEvent | null>(null);
  const flushTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Stable callbacks ref
  const callbacksRef = useRef({
    onCameraHealthBatch,
    onTrackUpdatedBatch,
    onSightingCreated,
    onJourneyUpdated,
  });
  callbacksRef.current = {
    onCameraHealthBatch,
    onTrackUpdatedBatch,
    onSightingCreated,
    onJourneyUpdated,
  };

  const flush = useCallback(() => {
    // 1. Process coalesced camera.health
    if (pendingCameraHealthRef.current.size > 0) {
      const updates = Array.from(pendingCameraHealthRef.current.values());
      pendingCameraHealthRef.current.clear();

      setCameraHealthMap((prev) => {
        const next = { ...prev };
        for (const item of updates) {
          next[item.cameraId] = item;
        }
        return next;
      });

      callbacksRef.current.onCameraHealthBatch?.(updates);
    }

    // 2. Process coalesced track.updated
    if (pendingTracksRef.current.size > 0) {
      const tracks = Array.from(pendingTracksRef.current.values());
      pendingTracksRef.current.clear();

      setActiveTracksMap((prev) => {
        const next = { ...prev };
        for (const t of tracks) {
          next[String(t.trackId)] = t;
        }
        return next;
      });

      callbacksRef.current.onTrackUpdatedBatch?.(tracks);
    }

    // 3. Process sighting.created
    if (pendingSightingsRef.current.length > 0) {
      const newSightings = [...pendingSightingsRef.current];
      pendingSightingsRef.current = [];

      setRecentSightings((prev) => [...newSightings, ...prev].slice(0, 100));
      for (const s of newSightings) {
        callbacksRef.current.onSightingCreated?.(s);
      }
    }

    // 4. Process journey.updated
    if (pendingJourneyRef.current) {
      const journey = pendingJourneyRef.current;
      pendingJourneyRef.current = null;

      setActiveJourney(journey);
      callbacksRef.current.onJourneyUpdated?.(journey);
    }

    flushTimerRef.current = null;
  }, []);

  const scheduleFlush = useCallback(() => {
    if (!flushTimerRef.current) {
      flushTimerRef.current = setTimeout(flush, coalesceIntervalMs);
    }
  }, [flush, coalesceIntervalMs]);

  useEffect(() => {
    const rawUrl =
      process.env.NEXT_PUBLIC_WS_URL ||
      process.env.NEXT_PUBLIC_SOCKET_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      'http://localhost:3001';
    const socketUrl = rawUrl
      .replace(/\/api\/v1\/?$/, '')
      .replace(/^ws:/, 'http:')
      .replace(/^wss:/, 'https:');

    const socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      withCredentials: true,
    });

    socketRef.current = socket;

    socket.on('connect_error', () => {
      // Gracefully handle backend reconnects without unhandled console errors
      setIsConnected(false);
    });

    socket.on('connect', () => {
      setIsConnected(true);
      // Join site room
      if (siteId) {
        socket.emit('join:site', { siteId });
      }
      // Join case room
      if (caseId) {
        socket.emit('join:case', { caseId });
      }
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Event listeners
    socket.on('camera.health', (event: CameraHealthEvent) => {
      pendingCameraHealthRef.current.set(event.cameraId, event);
      scheduleFlush();
    });

    socket.on('track.updated', (event: TrackUpdatedEvent) => {
      pendingTracksRef.current.set(String(event.trackId), event);
      scheduleFlush();
    });

    socket.on('sighting.created', (event: SightingCreatedEvent) => {
      pendingSightingsRef.current.push(event);
      scheduleFlush();
    });

    socket.on('journey.updated', (event: JourneyUpdatedEvent) => {
      pendingJourneyRef.current = event;
      scheduleFlush();
    });

    return () => {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      if (siteId) {
        socket.emit('leave:site', { siteId });
      }
      if (caseId) {
        socket.emit('leave:case', { caseId });
      }
      socket.disconnect();
      socketRef.current = null;
    };
  }, [siteId, caseId, scheduleFlush]);

  return {
    isConnected,
    cameraHealthMap,
    activeTracksMap,
    recentSightings,
    activeJourney,
    flush,
  };
}
