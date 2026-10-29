'use client';

import React, { useEffect, useRef } from 'react';
import { useSocket } from '@/hooks/useSocket';

interface DetectionBox {
  trackId: string;
  cameraId: string;
  bbox: [number, number, number, number]; // [ymin, xmin, ymax, xmax] normalized 0..1
  confidence?: number;
  ts: number;
}

interface AiOverlayCanvasProps {
  cameraId: string;
  enabled: boolean;
  videoElement: HTMLVideoElement | null;
  className?: string;
}

const BUFFER_DELAY_MS = 300; // Client-side 300ms buffer to align WebSocket tracks with WebRTC video playback

export const AiOverlayCanvas: React.FC<AiOverlayCanvasProps> = ({
  cameraId,
  enabled,
  videoElement,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const trackBufferRef = useRef<Map<string, DetectionBox[]>>(new Map());
  const socket = useSocket();

  // Listen for realtime track events from WebSocket
  useEffect(() => {
    if (!enabled || !socket) return;

    const handleTrackUpdate = (data: any) => {
      if (data.cameraId !== cameraId) return;

      const trackId = data.trackId || 'trk_unknown';
      const now = Date.now();
      const rawBbox = data.bbox || [0.2, 0.2, 0.6, 0.6];
      const confidence = typeof data.confidence === 'number' ? data.confidence : 0.88;

      const box: DetectionBox = {
        trackId,
        cameraId,
        bbox: rawBbox,
        confidence,
        ts: data.ts ? new Date(data.ts).getTime() : now,
      };

      const buffer = trackBufferRef.current.get(trackId) || [];
      buffer.push(box);
      // Keep only latest 10 samples per track
      if (buffer.length > 10) buffer.shift();
      trackBufferRef.current.set(trackId, buffer);
    };

    socket.on('track.updated', handleTrackUpdate);
    return () => {
      socket.off('track.updated', handleTrackUpdate);
    };
  }, [cameraId, enabled, socket]);

  // Synthetic local fallback tracks for demonstration/mock mode
  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const t = (now / 1500) % (Math.PI * 2);
      const x1 = 0.35 + Math.sin(t) * 0.15;
      const y1 = 0.25 + Math.cos(t * 0.7) * 0.08;
      const w = 0.16;
      const h = 0.45;

      const syntheticBox: DetectionBox = {
        trackId: `track_${cameraId.slice(-4)}_A`,
        cameraId,
        bbox: [y1, x1, y1 + h, x1 + w],
        confidence: 0.91,
        ts: now,
      };

      const buffer = trackBufferRef.current.get(syntheticBox.trackId) || [];
      buffer.push(syntheticBox);
      if (buffer.length > 8) buffer.shift();
      trackBufferRef.current.set(syntheticBox.trackId, buffer);
    }, 200);

    return () => clearInterval(interval);
  }, [cameraId, enabled]);

  // Render loop with timestamp interpolation
  useEffect(() => {
    if (!enabled) {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    let animId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Match canvas dimensions to display size
      const rect = canvas.getBoundingClientRect();
      if (canvas.width !== rect.width || canvas.height !== rect.height) {
        canvas.width = rect.width;
        canvas.height = rect.height;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const renderTimestamp = Date.now() - BUFFER_DELAY_MS;
      const width = canvas.width;
      const height = canvas.height;

      // Draw active tracks
      trackBufferRef.current.forEach((samples, trackId) => {
        // Clean out stale samples (> 3s old)
        const recent = samples.filter((s) => Date.now() - s.ts < 3000);
        if (recent.length === 0) {
          trackBufferRef.current.delete(trackId);
          return;
        }

        // Interpolate or take closest to renderTimestamp
        let target = recent[recent.length - 1];
        for (let i = 0; i < recent.length - 1; i++) {
          if (recent[i].ts <= renderTimestamp && recent[i + 1].ts >= renderTimestamp) {
            const frac = (renderTimestamp - recent[i].ts) / (recent[i + 1].ts - recent[i].ts);
            const b1 = recent[i].bbox;
            const b2 = recent[i + 1].bbox;
            target = {
              trackId,
              cameraId,
              confidence: recent[i + 1].confidence,
              ts: renderTimestamp,
              bbox: [
                b1[0] + (b2[0] - b1[0]) * frac,
                b1[1] + (b2[1] - b1[1]) * frac,
                b1[2] + (b2[2] - b1[2]) * frac,
                b1[3] + (b2[3] - b1[3]) * frac,
              ],
            };
            break;
          }
        }

        const [ymin, xmin, ymax, xmax] = target.bbox;
        const boxX = xmin * width;
        const boxY = ymin * height;
        const boxW = (xmax - xmin) * width;
        const boxH = (ymax - ymin) * height;

        // Bounding box: high-contrast neon cyan with corner brackets
        ctx.strokeStyle = '#06b6d4'; // cyan-500
        ctx.lineWidth = 2;
        ctx.strokeRect(boxX, boxY, boxW, boxH);

        // Corner accents
        const cornerLen = Math.min(14, boxW / 4, boxH / 4);
        ctx.strokeStyle = '#38bdf8'; // sky-400
        ctx.lineWidth = 3;

        // Top-left
        ctx.beginPath();
        ctx.moveTo(boxX, boxY + cornerLen);
        ctx.lineTo(boxX, boxY);
        ctx.lineTo(boxX + cornerLen, boxY);
        ctx.stroke();

        // Top-right
        ctx.beginPath();
        ctx.moveTo(boxX + boxW - cornerLen, boxY);
        ctx.lineTo(boxX + boxW, boxY);
        ctx.lineTo(boxX + boxW, boxY + cornerLen);
        ctx.stroke();

        // Label pill (Track ID + Confidence - NEVER an identity claim)
        const labelText = `ID: ${target.trackId.toUpperCase()} • ${Math.round((target.confidence ?? 0.85) * 100)}% CONF`;
        ctx.font = 'bold 10px monospace';
        const textMetrics = ctx.measureText(labelText);
        const pillW = textMetrics.width + 12;
        const pillH = 18;
        const pillY = Math.max(0, boxY - pillH - 2);

        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)'; // slate-900 / 85%
        ctx.fillRect(boxX, pillY, pillW, pillH);

        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 1;
        ctx.strokeRect(boxX, pillY, pillW, pillH);

        ctx.fillStyle = '#f8fafc';
        ctx.fillText(labelText, boxX + 6, pillY + 13);
      });

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [enabled, cameraId]);

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
    />
  );
};
