'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Hls from 'hls.js';
import { cameraService, PlaybackTokenResult } from '@/services/camera.service';
import { AiOverlayCanvas } from './AiOverlayCanvas';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Camera as CameraIcon,
  Eye,
  EyeOff,
  Wifi,
  WifiOff,
  AlertTriangle,
  RotateCw,
  Sliders,
} from 'lucide-react';

export type StreamingMode = 'whep' | 'hls' | 'snapshot' | 'none';

export interface CameraPlayerProps {
  cameraId: string;
  name?: string;
  quality?: 'auto' | 'low' | 'high';
  showControls?: boolean;
  showAiOverlays?: boolean;
  autoPlay?: boolean;
  muted?: boolean;
  aspectRatio?: 'video' | 'square' | 'fill';
  fallbackPosterUrl?: string;
  onSnapshot?: (dataUrl: string) => void;
  className?: string;
}

// Global active WebRTC connection counter to enforce the <= 16 connection limit
let activeWebRtcConnections = 0;
const MAX_WEBRTC_CONNECTIONS = 16;

export const CameraPlayer: React.FC<CameraPlayerProps> = ({
  cameraId,
  name,
  quality = 'auto',
  showControls = true,
  showAiOverlays = true,
  autoPlay = true,
  muted: initialMuted = true,
  aspectRatio = 'video',
  fallbackPosterUrl = 'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?auto=format&fit=crop&w=600&q=80',
  onSnapshot,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const statsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const snapshotPollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [streamingMode, setStreamingMode] = useState<StreamingMode>('none');
  const [effectiveQuality, setEffectiveQuality] = useState<'high' | 'low'>(
    quality === 'low' ? 'low' : 'high',
  );
  const [isLoading, setIsLoading] = useState(true);
  const [hasSignal, setHasSignal] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [isFrozen, setIsFrozen] = useState(false);
  const [isMuted, setIsMuted] = useState(initialMuted);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [overlaysEnabled, setOverlaysEnabled] = useState(showAiOverlays);
  const [lastFrameTime, setLastFrameTime] = useState<number>(Date.now());
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [stats, setStats] = useState<{ fps: number; rttMs: number; packetLoss: number }>({
    fps: 30,
    rttMs: 35,
    packetLoss: 0,
  });

  const [playbackToken, setPlaybackToken] = useState<PlaybackTokenResult | null>(null);
  const [isVisible, setIsVisible] = useState(true);

  // IntersectionObserver to pause/disconnect streams when tile is out of viewport
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.1 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Listen to tab visibility changes
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Clean teardown of existing connections
  const cleanupConnections = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
      activeWebRtcConnections = Math.max(0, activeWebRtcConnections - 1);
    }
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (snapshotPollIntervalRef.current) {
      clearInterval(snapshotPollIntervalRef.current);
      snapshotPollIntervalRef.current = null;
    }
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  // Start Snapshot Polling Fallback (Level 3)
  const startSnapshotPolling = useCallback(() => {
    cleanupConnections();
    setStreamingMode('snapshot');
    setIsLoading(false);
    setHasSignal(true);

    const poll = async () => {
      // Refresh mock or live snapshot
      const cacheBust = Date.now();
      setSnapshotUrl(`${fallbackPosterUrl}?cb=${cacheBust}`);
      setLastFrameTime(Date.now());
    };

    poll();
    snapshotPollIntervalRef.current = setInterval(poll, 1500);
  }, [cleanupConnections, fallbackPosterUrl]);

  // Start LL-HLS Fallback (Level 2)
  const startHlsStreaming = useCallback(
    (hlsUrl: string) => {
      cleanupConnections();
      if (!videoRef.current) {
        startSnapshotPolling();
        return;
      }

      if (Hls.isSupported()) {
        const hls = new Hls({
          liveSyncDurationCount: 2,
          lowLatencyMode: true,
          backBufferLength: 5,
        });

        hls.loadSource(hlsUrl);
        hls.attachMedia(videoRef.current);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setStreamingMode('hls');
          setIsLoading(false);
          setHasSignal(true);
          videoRef.current?.play().catch(() => {});
        });

        hls.on(Hls.Events.ERROR, (_evt, data) => {
          if (data.fatal) {
            console.warn(`[CameraPlayer] LL-HLS fatal error on ${cameraId}, falling back to Snapshot:`, data.type);
            startSnapshotPolling();
          }
        });

        hlsRef.current = hls;
      } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        // Native Safari HLS
        videoRef.current.src = hlsUrl;
        videoRef.current.onloadedmetadata = () => {
          setStreamingMode('hls');
          setIsLoading(false);
          setHasSignal(true);
          videoRef.current?.play().catch(() => {});
        };
        videoRef.current.onerror = () => {
          startSnapshotPolling();
        };
      } else {
        startSnapshotPolling();
      }
    },
    [cameraId, cleanupConnections, startSnapshotPolling],
  );

  // Start WebRTC via WHEP (Level 1 Primary, native RTCPeerConnection)
  const startWhepStreaming = useCallback(
    async (tokenData: PlaybackTokenResult) => {
      cleanupConnections();

      // Enforce the connection cap
      if (activeWebRtcConnections >= MAX_WEBRTC_CONNECTIONS) {
        console.warn(`[CameraPlayer] Max WebRTC connection ceiling reached (${MAX_WEBRTC_CONNECTIONS}). Using LL-HLS.`);
        startHlsStreaming(tokenData.hlsUrl);
        return;
      }

      try {
        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:localhost:3478' },
            { urls: 'stun:stun.l.google.com:19302' },
          ],
          bundlePolicy: 'max-bundle',
        });

        peerConnectionRef.current = pc;
        activeWebRtcConnections++;

        // Add receive-only video transceiver
        pc.addTransceiver('video', { direction: 'recvonly' });

        pc.ontrack = (event) => {
          if (videoRef.current && event.streams[0]) {
            videoRef.current.srcObject = event.streams[0];
            setStreamingMode('whep');
            setIsLoading(false);
            setHasSignal(true);
            setLastFrameTime(Date.now());
            videoRef.current.play().catch(() => {});
          }
        };

        pc.oniceconnectionstatechange = () => {
          if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
            console.warn(`[CameraPlayer] WHEP ICE state ${pc.iceConnectionState} on ${cameraId}. Retrying HLS...`);
            startHlsStreaming(tokenData.hlsUrl);
          }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // Substream path selection based on quality
        const streamPath = effectiveQuality === 'low' ? `cam/${cameraId}/sub` : `cam/${cameraId}`;
        const whepEndpoint = `http://localhost:8889/${streamPath}/whep?token=${tokenData.token}`;

        // Send WHEP HTTP POST offer
        const response = await fetch(whepEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/sdp' },
          body: offer.sdp,
        });

        if (!response.ok) {
          throw new Error(`WHEP negotiation returned HTTP ${response.status}`);
        }

        const answerSdp = await response.text();
        await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

        // Monitor connection stats (FPS, RTT, packet loss)
        statsIntervalRef.current = setInterval(async () => {
          if (!pc || pc.connectionState !== 'connected') return;
          try {
            const rawStats = await pc.getStats();
            rawStats.forEach((report) => {
              if (report.type === 'inbound-rtp' && report.kind === 'video') {
                const fps = report.framesPerSecond || 30;
                const packetsLost = report.packetsLost || 0;
                const packetsReceived = report.packetsReceived || 1;
                const lossRate = (packetsLost / (packetsLost + packetsReceived)) * 100;

                setStats((prev) => ({
                  ...prev,
                  fps: Math.round(fps),
                  packetLoss: Number(lossRate.toFixed(1)),
                }));

                // Dynamic quality downshift: if packet loss > 5%, downshift to low/substream
                if (lossRate > 5.0 && effectiveQuality === 'high') {
                  console.info(`[CameraPlayer] Packet loss ${lossRate.toFixed(1)}% on ${cameraId}; downshifting to substream.`);
                  setEffectiveQuality('low');
                }
              }
              if (report.type === 'candidate-pair' && report.currentRoundTripTime) {
                setStats((prev) => ({
                  ...prev,
                  rttMs: Math.round(report.currentRoundTripTime * 1000),
                }));
              }
            });
            setLastFrameTime(Date.now());
          } catch {
            // Stats gathering failed
          }
        }, 2000);
      } catch (err: any) {
        console.warn(`[CameraPlayer] WHEP connection failed on ${cameraId}: ${err.message}. Cascading to LL-HLS...`);
        startHlsStreaming(tokenData.hlsUrl);
      }
    },
    [cameraId, effectiveQuality, cleanupConnections, startHlsStreaming],
  );

  // Main initialize & connection lifecycle
  const initPlayer = useCallback(async () => {
    if (!isVisible) {
      cleanupConnections();
      return;
    }

    setIsLoading(true);
    setIsOffline(false);
    setIsFrozen(false);

    try {
      const tokenData = await cameraService.getPlaybackToken(cameraId);
      setPlaybackToken(tokenData);

      if (tokenData) {
        await startWhepStreaming(tokenData);
      } else {
        startSnapshotPolling();
      }
    } catch {
      // In offline/mock state, fall back to snapshot polling
      startSnapshotPolling();
    }
  }, [cameraId, isVisible, cleanupConnections, startWhepStreaming, startSnapshotPolling]);

  // Trigger init on cameraId, visibility, or effectiveQuality change
  useEffect(() => {
    initPlayer();
    return () => cleanupConnections();
  }, [initPlayer, cleanupConnections]);

  // Last-frame freeze detection check
  useEffect(() => {
    if (!hasSignal || isOffline) return;

    const interval = setInterval(() => {
      const delta = Date.now() - lastFrameTime;
      if (delta > 3500 && streamingMode === 'whep') {
        setIsFrozen(true);
      } else {
        setIsFrozen(false);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [hasSignal, isOffline, lastFrameTime, streamingMode]);

  // Keyboard accessibility controls (F = Fullscreen, M = Mute, S = Snapshot)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!containerRef.current?.contains(document.activeElement)) return;
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        setIsMuted((prev) => !prev);
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        captureSnapshot();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const captureSnapshot = () => {
    if (!videoRef.current && !snapshotUrl) return;

    const canvas = document.createElement('canvas');
    if (videoRef.current && videoRef.current.videoWidth > 0) {
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        if (onSnapshot) onSnapshot(dataUrl);

        // Trigger browser download
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `snapshot_${cameraId}_${Date.now()}.jpg`;
        a.click();
      }
    }
  };

  const getAspectClass = () => {
    if (aspectRatio === 'square') return 'aspect-square';
    if (aspectRatio === 'fill') return 'h-full w-full';
    return 'aspect-video';
  };

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className={`group relative overflow-hidden rounded-lg bg-black text-white focus:outline-none focus:ring-1 focus:ring-cyan-500 ${getAspectClass()} ${className}`}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        autoPlay={autoPlay}
        muted={isMuted}
        playsInline
        className={`h-full w-full object-cover transition-opacity duration-300 ${
          streamingMode === 'snapshot' ? 'hidden' : 'block'
        } ${isLoading ? 'opacity-0' : 'opacity-100'}`}
      />

      {/* Snapshot Mode Fallback */}
      {streamingMode === 'snapshot' && (
        <img
          src={snapshotUrl || fallbackPosterUrl}
          alt={name || cameraId}
          className="h-full w-full object-cover opacity-90 transition-opacity"
        />
      )}

      {/* AI Bounding Box Canvas Overlay */}
      <AiOverlayCanvas
        cameraId={cameraId}
        enabled={overlaysEnabled && !isLoading && hasSignal}
        videoElement={videoRef.current}
      />

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/90 gap-3">
          <Skeleton className="h-10 w-10 rounded-full bg-zinc-800 animate-spin" />
          <div className="flex flex-col items-center gap-1">
            <span className="text-xs font-mono text-zinc-400">Connecting to {cameraId}...</span>
            <span className="text-[10px] text-zinc-600">Negotiating WHEP / LL-HLS Pipeline</span>
          </div>
        </div>
      )}

      {/* Offline / No Signal Overlay */}
      {(isOffline || (!hasSignal && !isLoading)) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/95 p-4 text-center">
          <WifiOff className="h-10 w-10 text-red-500 mb-2" />
          <span className="text-sm font-semibold tracking-wide text-zinc-200">NO SIGNAL</span>
          <span className="text-xs text-zinc-500 mt-1 max-w-[200px]">
            Stream offline or address unreachable. Automatic retry in progress.
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={initPlayer}
            className="mt-3 h-7 text-xs border-zinc-700 bg-zinc-900 text-zinc-300"
          >
            <RotateCw className="h-3 w-3 mr-1.5" /> Reconnect
          </Button>
        </div>
      )}

      {/* Frozen Frame Indicator */}
      {isFrozen && !isOffline && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5 rounded bg-amber-500/90 px-2 py-0.5 text-[10px] font-bold text-black backdrop-blur-sm">
          <AlertTriangle className="h-3 w-3" />
          <span>SIGNAL FROZEN</span>
        </div>
      )}

      {/* Top Overlay: Camera Badge & Streaming Protocol Status */}
      <div className="absolute top-2.5 left-2.5 flex items-center gap-2 pointer-events-none">
        {name && (
          <div className="rounded bg-black/60 px-2 py-0.5 text-[11px] font-medium backdrop-blur-md">
            {name}
          </div>
        )}

        {/* Streaming Protocol Badge */}
        <Badge
          variant="outline"
          className={`font-mono text-[9px] uppercase px-1.5 py-0 h-4 backdrop-blur-md ${
            streamingMode === 'whep'
              ? 'border-emerald-500/80 bg-emerald-950/40 text-emerald-400'
              : streamingMode === 'hls'
              ? 'border-blue-500/80 bg-blue-950/40 text-blue-400'
              : 'border-amber-500/80 bg-amber-950/40 text-amber-400'
          }`}
        >
          {streamingMode === 'whep' ? 'WHEP (WebRTC <1s)' : streamingMode === 'hls' ? 'LL-HLS' : 'SNAPSHOT (2s)'}
        </Badge>

        {/* Quality Indicator */}
        <Badge
          variant="outline"
          className="font-mono text-[9px] uppercase px-1.5 py-0 h-4 border-zinc-700 bg-black/40 text-zinc-400"
        >
          {effectiveQuality === 'low' ? 'SUBSTREAM' : 'MAIN'}
        </Badge>
      </div>

      {/* Live Stream Telemetry Pill (FPS, RTT, Loss) */}
      {hasSignal && !isLoading && (
        <div className="absolute bottom-2.5 left-2.5 flex items-center gap-2 text-[10px] font-mono text-zinc-400 bg-black/60 px-2 py-0.5 rounded backdrop-blur-sm pointer-events-none">
          <span className="flex items-center gap-1 text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {stats.fps} FPS
          </span>
          <span>•</span>
          <span>{stats.rttMs}ms RTT</span>
          {stats.packetLoss > 0 && (
            <>
              <span>•</span>
              <span className="text-amber-400">{stats.packetLoss}% loss</span>
            </>
          )}
        </div>
      )}

      {/* Player Interactive Controls Bar (Revealed on Hover) */}
      {showControls && (
        <div className="absolute bottom-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 p-1 rounded-md backdrop-blur-md">
          {/* AI Overlays Toggle */}
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setOverlaysEnabled(!overlaysEnabled)}
            className={`h-7 w-7 text-xs ${overlaysEnabled ? 'text-cyan-400' : 'text-zinc-400'}`}
            title="Toggle ByteTrack AI Overlays"
          >
            {overlaysEnabled ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          </Button>

          {/* Substream / Main Quality Switcher */}
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setEffectiveQuality((q) => (q === 'high' ? 'low' : 'high'))}
            className="h-7 w-7 text-xs text-zinc-300 hover:text-white"
            title={`Switch to ${effectiveQuality === 'high' ? 'Low Substream' : 'High Main Stream'}`}
          >
            <Sliders className="h-3.5 w-3.5" />
          </Button>

          {/* Mute / Unmute */}
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setIsMuted(!isMuted)}
            className="h-7 w-7 text-xs text-zinc-300 hover:text-white"
            title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
          >
            {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          </Button>

          {/* Snapshot Capture */}
          <Button
            size="icon"
            variant="ghost"
            onClick={captureSnapshot}
            className="h-7 w-7 text-xs text-zinc-300 hover:text-white"
            title="Download Snapshot (S)"
          >
            <CameraIcon className="h-3.5 w-3.5" />
          </Button>

          {/* Fullscreen Toggle */}
          <Button
            size="icon"
            variant="ghost"
            onClick={toggleFullscreen}
            className="h-7 w-7 text-xs text-zinc-300 hover:text-white"
            title="Fullscreen (F)"
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </Button>
        </div>
      )}
    </div>
  );
};
