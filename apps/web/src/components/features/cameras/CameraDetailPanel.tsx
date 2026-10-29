'use client';

import React, { useState, useMemo } from 'react';
import { Camera, CameraTopologyTransition, Sighting } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CameraPlayer } from './CameraPlayer';
import { useCameras, useCameraTopology, useUpdateCamera } from '@/hooks/use-cameras';
import { useSightings } from '@/hooks/use-sightings';
import {
  X,
  Maximize2,
  Settings,
  Activity,
  Network,
  Cpu,
  HardDrive,
  Copy,
  Check,
  Search,
  Radio,
  Wifi,
  WifiOff,
  BatteryMedium,
  Compass,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ZoomIn,
  Video,
  AlertTriangle,
  Play,
  RotateCw,
  Plus,
  Trash2,
  Shield,
  Smartphone,
  Navigation,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface CameraDetailPanelProps {
  camera: Camera;
  onClose: () => void;
  onSelectCameraById?: (id: string) => void;
  onEnterTopologyEdit?: () => void;
  onOpenLiveWall?: () => void;
}

export function CameraDetailPanel({
  camera,
  onClose,
  onSelectCameraById,
  onEnterTopologyEdit,
  onOpenLiveWall,
}: CameraDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<'live' | 'health' | 'topology' | 'ai' | 'recording' | 'settings'>('live');
  const [streamQuality, setStreamQuality] = useState<'substream' | 'main'>('substream');
  const [showOverlays, setShowOverlays] = useState(true);
  const [copiedRtsp, setCopiedRtsp] = useState(false);
  const [snapshotTaken, setSnapshotTaken] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // React Query data & mutators
  const { data: allTransitions = [] } = useCameraTopology();
  const { data: allCameras = [] } = useCameras();
  const { data: sightings = [] } = useSightings();
  const updateCameraMutation = useUpdateCamera();
  const updateCamera = (id: string, dto: Partial<Camera>) => updateCameraMutation.mutate({ id, dto });
  const deleteCamera = (_id: string) => {};

  const isLive = camera.status === 'live';
  const isOffline = camera.status === 'offline';
  const isDegraded = camera.status === 'degraded';

  // Mobile specific check
  const isMobile = camera.sourceType === 'mobile_webrtc' || camera.sourceType === 'mobile_rtmp';

  // Inbound & Outbound Transitions
  const inboundTransitions = useMemo(() => {
    return allTransitions.filter(
      (t: CameraTopologyTransition) => t.toCamera === camera.id || t.toCamera === camera.cameraCode || (t.isTwoWay && (t.fromCamera === camera.id || t.fromCamera === camera.cameraCode)),
    );
  }, [allTransitions, camera.id, camera.cameraCode]);

  const outboundTransitions = useMemo(() => {
    return allTransitions.filter(
      (t: CameraTopologyTransition) => t.fromCamera === camera.id || t.fromCamera === camera.cameraCode || (t.isTwoWay && (t.toCamera === camera.id || t.toCamera === camera.cameraCode)),
    );
  }, [allTransitions, camera.id, camera.cameraCode]);

  // Recent sightings for this camera
  const cameraSightings = useMemo(() => {
    return sightings
      .filter((s) => s.cameraId === camera.id || s.cameraId === camera.cameraCode)
      .slice(0, 5);
  }, [sightings, camera.id, camera.cameraCode]);

  const handleCopyRtsp = () => {
    if (camera.rtspUrl) {
      navigator.clipboard.writeText(camera.rtspUrl);
      setCopiedRtsp(true);
      setTimeout(() => setCopiedRtsp(false), 2000);
    }
  };

  const handleTakeSnapshot = () => {
    setSnapshotTaken(true);
    setTimeout(() => setSnapshotTaken(false), 2500);
  };

  const handleToggleAi = (enabled: boolean) => {
    updateCamera(camera.id, {
      aiPolicy: {
        ...(camera.aiPolicy || { sampleFps: 2.0, minDetectionConf: 0.65 }),
        enabled,
      },
    });
  };

  const handleSampleFpsChange = (val: number[]) => {
    updateCamera(camera.id, {
      aiPolicy: {
        ...(camera.aiPolicy || { enabled: true, minDetectionConf: 0.65 }),
        sampleFps: val[0],
      },
    });
  };

  const handleMinConfChange = (val: number[]) => {
    updateCamera(camera.id, {
      aiPolicy: {
        ...(camera.aiPolicy || { enabled: true, sampleFps: 2.0 }),
        minDetectionConf: val[0] / 100,
      },
    });
  };

  const handleDelete = () => {
    deleteCamera(camera.id);
    onClose();
  };

  return (
    <div
      data-testid="camera-detail-panel"
      className="flex flex-col h-full bg-card border-l border-border select-none shadow-xl transition-all duration-200"
    >
      {/* Header */}
      <div className="p-4 border-b border-border bg-muted/20 shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-base font-bold tracking-tight text-foreground">
                {camera.cameraCode || camera.id}
              </span>
              <Badge
                variant={
                  isLive
                    ? 'default'
                    : isDegraded
                    ? 'outline'
                    : 'destructive'
                }
                className={cn(
                  'text-[10px] font-semibold uppercase tracking-wider h-5 px-2',
                  isLive && 'bg-emerald-600 hover:bg-emerald-700 text-white',
                  isDegraded && 'border-amber-500 text-amber-500 bg-amber-500/10',
                  isOffline && 'bg-rose-600 hover:bg-rose-700 text-white',
                )}
              >
                {camera.status}
              </Badge>
              {isMobile && (
                <Badge variant="secondary" className="text-[10px] gap-1 h-5 bg-blue-500/10 text-blue-500 border border-blue-500/20">
                  <Smartphone className="h-3 w-3" />
                  Mobile Bodycam
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground font-medium truncate max-w-[280px]">
              {camera.name}
            </p>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span>{camera.siteName || camera.locationName}</span>
              <span>·</span>
              <span>Floor {camera.floor !== undefined ? (camera.floor >= 0 ? `L${camera.floor}` : `B${Math.abs(camera.floor)}`) : 'G'}</span>
              <span>·</span>
              <span>{camera.zone}</span>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {onOpenLiveWall && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                title="Expand to Fullscreen Live Wall"
                onClick={onOpenLiveWall}
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              title="Camera Settings"
              onClick={() => setActiveTab('settings')}
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              title="Close panel"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Tab Switcher */}
        <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="mt-3">
          <TabsList className="grid grid-cols-6 h-8 p-0.5 bg-muted/60 text-[11px]">
            <TabsTrigger value="live" className="text-[11px] px-1 py-1">Live</TabsTrigger>
            <TabsTrigger value="health" className="text-[11px] px-1 py-1">Health</TabsTrigger>
            <TabsTrigger value="topology" className="text-[11px] px-1 py-1">Topology</TabsTrigger>
            <TabsTrigger value="ai" className="text-[11px] px-1 py-1">AI</TabsTrigger>
            <TabsTrigger value="recording" className="text-[11px] px-1 py-1">Playback</TabsTrigger>
            <TabsTrigger value="settings" className="text-[11px] px-1 py-1">Settings</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* ================= TAB 1: LIVE ================= */}
        {activeTab === 'live' && (
          <div className="space-y-4">
            {/* Stream Player / Offline Canvas */}
            <div className="relative aspect-video rounded-lg overflow-hidden bg-black border border-border shadow-inner flex items-center justify-center">
              {isOffline ? (
                <div className="relative w-full h-full flex flex-col items-center justify-center p-4">
                  {camera.thumbnailUrl && (
                    <img
                      src={camera.thumbnailUrl}
                      alt={camera.name}
                      className="absolute inset-0 w-full h-full object-cover filter brightness-30 grayscale"
                    />
                  )}
                  <div className="relative z-10 flex flex-col items-center gap-2 text-center p-4 rounded-lg bg-background/80 backdrop-blur border border-border shadow-md">
                    <WifiOff className="h-7 w-7 text-rose-500 animate-pulse" />
                    <span className="font-semibold text-xs text-foreground">
                      Camera Stream Offline
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Last frame received 14 minutes ago
                    </span>
                    <Badge variant="outline" className="text-[10px] border-rose-500/40 text-rose-400">
                      No active tracks or detection overlays
                    </Badge>
                  </div>
                </div>
              ) : (
                <div className="w-full h-full relative">
                  <CameraPlayer
                    cameraId={camera.id}
                    name={camera.name}
                    quality={streamQuality === 'main' ? 'high' : 'low'}
                    showControls={false}
                    showAiOverlays={showOverlays && isLive && !!camera.aiPolicy?.enabled}
                    fallbackPosterUrl={camera.thumbnailUrl}
                  />

                  {/* Simulated Stream Badge */}
                  <div className="absolute top-2 left-2 z-20 flex items-center gap-1.5 px-2 py-0.5 rounded bg-black/70 backdrop-blur border border-white/20 text-[10px] text-white font-mono">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>SIMULATED FEED · {streamQuality === 'main' ? 'MAIN (4K)' : 'SUBSTREAM (720p)'}</span>
                  </div>

                  {snapshotTaken && (
                    <div className="absolute inset-0 z-30 bg-white/40 flex items-center justify-center animate-out fade-out duration-700 pointer-events-none">
                      <Badge className="bg-black text-white text-xs py-1 px-3">
                        Snapshot captured & saved to evidence
                      </Badge>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Stream Control & Overlay Toggles */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">Stream Stream:</span>
                <div className="flex items-center rounded-md border border-border p-0.5 bg-background">
                  <button
                    type="button"
                    onClick={() => setStreamQuality('substream')}
                    className={cn(
                      'px-2 py-1 rounded text-[11px] font-medium transition-colors',
                      streamQuality === 'substream' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    WHEP Substream
                  </button>
                  <button
                    type="button"
                    onClick={() => setStreamQuality('main')}
                    className={cn(
                      'px-2 py-1 rounded text-[11px] font-medium transition-colors',
                      streamQuality === 'main' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    Main (4K)
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Label htmlFor="overlay-toggle" className="text-[11px] cursor-pointer">
                  AI Overlays
                </Label>
                <Switch
                  id="overlay-toggle"
                  checked={showOverlays && isLive}
                  disabled={isOffline}
                  onCheckedChange={setShowOverlays}
                />
              </div>
            </div>

            {/* Quick Actions Row */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs justify-start gap-1.5"
                onClick={handleTakeSnapshot}
                disabled={isOffline}
              >
                <RotateCw className="h-3.5 w-3.5" />
                Take snapshot
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs justify-start gap-1.5"
                onClick={handleCopyRtsp}
              >
                {copiedRtsp ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedRtsp ? 'Copied URL' : 'Copy RTSP URL'}
              </Button>

              <Link href={`/search?camera=${camera.id}`} className="col-span-2">
                <Button
                  variant="default"
                  size="sm"
                  className="w-full h-8 text-xs justify-center gap-1.5"
                >
                  <Search className="h-3.5 w-3.5" />
                  Trigger AI Search from this camera
                </Button>
              </Link>
            </div>

            {/* PTZ Simulated Controls (for PTZ capable cameras) */}
            <div className="p-3 rounded-lg border border-border bg-muted/10 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <Compass className="h-3.5 w-3.5 text-muted-foreground" />
                  PTZ Directional Control
                </span>
                <span className="text-[10px] text-muted-foreground">Pan/Tilt/Zoom</span>
              </div>
              <div className="flex items-center justify-center gap-2 py-1">
                <div className="grid grid-cols-3 gap-1 w-28">
                  <div />
                  <Button variant="outline" size="icon" className="h-7 w-7"><ArrowUp className="h-3.5 w-3.5" /></Button>
                  <div />
                  <Button variant="outline" size="icon" className="h-7 w-7"><ArrowLeft className="h-3.5 w-3.5" /></Button>
                  <div className="flex items-center justify-center text-[10px] text-muted-foreground font-mono">PTZ</div>
                  <Button variant="outline" size="icon" className="h-7 w-7"><ArrowRight className="h-3.5 w-3.5" /></Button>
                  <div />
                  <Button variant="outline" size="icon" className="h-7 w-7"><ArrowDown className="h-3.5 w-3.5" /></Button>
                  <div />
                </div>
                <div className="flex flex-col gap-1.5 ml-3">
                  <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1 px-2">
                    <ZoomIn className="h-3 w-3" /> Zoom In
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1 px-2">
                    <RotateCw className="h-3 w-3" /> Reset View
                  </Button>
                </div>
              </div>
            </div>

            {/* Mobile Device Specs (when mobile) */}
            {isMobile && (
              <div className="p-3 rounded-lg border border-border bg-blue-500/5 space-y-2 text-xs">
                <div className="flex items-center justify-between font-semibold text-foreground">
                  <span className="flex items-center gap-1.5 text-blue-500">
                    <Smartphone className="h-4 w-4" />
                    Mobile Bodycam Telemetry
                  </span>
                  <Badge variant="outline" className="border-blue-500/40 text-blue-500">
                    5G Active
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-muted-foreground">Battery:</span>
                    <span className="ml-1 font-mono font-medium text-foreground">82%</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Operator:</span>
                    <span className="ml-1 font-mono font-medium text-foreground">Insp. Sarah Vance</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">GPS Accuracy:</span>
                    <span className="ml-1 font-mono font-medium text-foreground">± 2.4 m</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Device Platform:</span>
                    <span className="ml-1 font-mono font-medium text-foreground">Pixel 8 / Android 14</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 2: HEALTH & TELEMETRY ================= */}
        {activeTab === 'health' && (
          <div className="space-y-4">
            {/* Sparkline Metric Cards */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-lg border border-border bg-card space-y-1">
                <span className="text-[11px] text-muted-foreground">Frame Rate</span>
                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-mono font-bold text-foreground">
                    {camera.health?.fps ?? camera.fps} <span className="text-xs font-normal text-muted-foreground">fps</span>
                  </span>
                  <Badge variant="outline" className="text-[10px] h-4">Target: 30</Badge>
                </div>
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn('h-full', isOffline ? 'w-0' : isDegraded ? 'w-1/2 bg-amber-500' : 'w-full bg-emerald-500')}
                  />
                </div>
              </div>

              <div className="p-3 rounded-lg border border-border bg-card space-y-1">
                <span className="text-[11px] text-muted-foreground">Bitrate</span>
                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-mono font-bold text-foreground">
                    {camera.health?.bitrate ?? camera.bitrateKbps ?? 4096} <span className="text-xs font-normal text-muted-foreground">Kbps</span>
                  </span>
                  <Badge variant="outline" className="text-[10px] h-4">H.264</Badge>
                </div>
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div className="h-full w-4/5 bg-primary" />
                </div>
              </div>

              <div className="p-3 rounded-lg border border-border bg-card space-y-1">
                <span className="text-[11px] text-muted-foreground">Packet Loss</span>
                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-mono font-bold text-foreground">
                    {camera.health?.packetLoss ?? 0.1}%
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[10px] h-4',
                      (camera.health?.packetLoss ?? 0) > 5 ? 'text-amber-500 border-amber-500' : 'text-emerald-500',
                    )}
                  >
                    {(camera.health?.packetLoss ?? 0) < 1 ? 'Optimal' : 'Elevated'}
                  </Badge>
                </div>
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full',
                      (camera.health?.packetLoss ?? 0) > 5 ? 'w-3/4 bg-amber-500' : 'w-1/12 bg-emerald-500',
                    )}
                  />
                </div>
              </div>

              <div className="p-3 rounded-lg border border-border bg-card space-y-1">
                <span className="text-[11px] text-muted-foreground">RTT Latency</span>
                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-mono font-bold text-foreground">
                    {camera.health?.latencyMs ?? 38} <span className="text-xs font-normal text-muted-foreground">ms</span>
                  </span>
                  <Badge variant="outline" className="text-[10px] h-4">WHEP Edge</Badge>
                </div>
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div className="h-full w-1/4 bg-emerald-500" />
                </div>
              </div>
            </div>

            {/* Ingest Node & Codec Telemetry */}
            <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-2 text-xs">
              <span className="font-semibold text-foreground">Media Transport Details</span>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-muted-foreground">Ingest Node:</span>
                  <span className="ml-1 font-mono font-medium text-foreground">edge-worker-02</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Codec / Profile:</span>
                  <span className="ml-1 font-mono font-medium text-foreground">H.264 (High @ L4.1)</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Resolution:</span>
                  <span className="ml-1 font-mono font-medium text-foreground">{camera.resolution || '1920x1080 (FHD)'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">GOP Size:</span>
                  <span className="ml-1 font-mono font-medium text-foreground">2.0s (60 frames)</span>
                </div>
                <div>
                  <span className="text-muted-foreground">24h Uptime:</span>
                  <span className="ml-1 font-mono font-medium text-emerald-500 font-bold">{camera.health?.uptimePercentage ?? 99.8}%</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Reconnect Count:</span>
                  <span className="ml-1 font-mono font-medium text-foreground">{camera.health?.reconnects ?? 0}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 3: TOPOLOGY ================= */}
        {activeTab === 'topology' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-semibold text-foreground">Connected Camera Nodes</h4>
                <p className="text-[11px] text-muted-foreground">Calibrated travel time pathways</p>
              </div>
              {onEnterTopologyEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={onEnterTopologyEdit}
                >
                  <Plus className="h-3 w-3" />
                  Edit Topology
                </Button>
              )}
            </div>

            {/* Inbound Transitions */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Inbound Transitions ({inboundTransitions.length})
              </span>
              {inboundTransitions.length === 0 ? (
                <p className="text-xs text-muted-foreground italic p-2 border border-dashed rounded">
                  No inbound transition edges configured.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {inboundTransitions.map((t: CameraTopologyTransition, idx: number) => {
                    const fromCam = allCameras.find((c) => c.id === t.fromCamera || c.cameraCode === t.fromCamera);
                    return (
                      <div
                        key={`in_${idx}`}
                        className="p-2 rounded border border-border bg-card flex items-center justify-between text-xs hover:border-foreground/40 cursor-pointer"
                        onClick={() => onSelectCameraById?.(t.fromCamera)}
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {fromCam?.cameraCode || t.fromCamera}
                          </Badge>
                          <span className="text-muted-foreground font-medium truncate max-w-[150px]">
                            {fromCam?.name || t.fromCamera}
                          </span>
                        </div>
                        <div className="text-right text-[11px]">
                          <span className="font-mono font-medium text-foreground">{t.minTravelSec}s - {t.maxTravelSec}s</span>
                          <span className="text-muted-foreground text-[10px] block">{t.distanceMeters ?? 90}m</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Outbound Transitions */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Outbound Transitions ({outboundTransitions.length})
              </span>
              {outboundTransitions.length === 0 ? (
                <p className="text-xs text-muted-foreground italic p-2 border border-dashed rounded">
                  No outbound transition edges configured.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {outboundTransitions.map((t: CameraTopologyTransition, idx: number) => {
                    const toCam = allCameras.find((c) => c.id === t.toCamera || c.cameraCode === t.toCamera);
                    return (
                      <div
                        key={`out_${idx}`}
                        className="p-2 rounded border border-border bg-card flex items-center justify-between text-xs hover:border-foreground/40 cursor-pointer"
                        onClick={() => onSelectCameraById?.(t.toCamera)}
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {toCam?.cameraCode || t.toCamera}
                          </Badge>
                          <span className="text-muted-foreground font-medium truncate max-w-[150px]">
                            {toCam?.name || t.toCamera}
                          </span>
                        </div>
                        <div className="text-right text-[11px]">
                          <span className="font-mono font-medium text-foreground">{t.minTravelSec}s - {t.maxTravelSec}s</span>
                          <span className="text-muted-foreground text-[10px] block">{t.distanceMeters ?? 90}m</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 4: AI & SEARCH ================= */}
        {activeTab === 'ai' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
              <div>
                <Label className="text-xs font-semibold text-foreground">AI Tracking Pipeline</Label>
                <p className="text-[11px] text-muted-foreground">ByteTrack + OSNet re-identification</p>
              </div>
              <Switch
                checked={camera.aiPolicy?.enabled ?? true}
                onCheckedChange={handleToggleAi}
              />
            </div>

            {/* Sampling Rate Slider */}
            <div className="p-3 rounded-lg border border-border bg-card space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">Inference Sampling Rate</span>
                <span className="font-mono font-bold text-foreground">
                  {camera.aiPolicy?.sampleFps ?? 2.0} fps
                </span>
              </div>
              <Slider
                min={1}
                max={10}
                step={0.5}
                value={[camera.aiPolicy?.sampleFps ?? 2.0]}
                onValueChange={handleSampleFpsChange}
              />
              <span className="text-[10px] text-muted-foreground block">
                Extracts 2 keyframes per second for biometric face & Re-ID vector indexing.
              </span>
            </div>

            {/* Min Detection Confidence */}
            <div className="p-3 rounded-lg border border-border bg-card space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">Min Detection Confidence</span>
                <span className="font-mono font-bold text-foreground">
                  {Math.round((camera.aiPolicy?.minDetectionConf ?? 0.65) * 100)}%
                </span>
              </div>
              <Slider
                min={50}
                max={95}
                step={5}
                value={[Math.round((camera.aiPolicy?.minDetectionConf ?? 0.65) * 100)]}
                onValueChange={handleMinConfChange}
              />
              <span className="text-[10px] text-muted-foreground block">
                Suppresses low-confidence bounding boxes to avoid false matches.
              </span>
            </div>

            {/* Recent Sightings on this Camera */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-foreground block">
                Recent Sightings on this Camera ({cameraSightings.length})
              </span>
              {cameraSightings.length === 0 ? (
                <p className="text-xs text-muted-foreground italic p-2 border border-dashed rounded">
                  No active sighting candidates recorded on this camera.
                </p>
              ) : (
                <div className="space-y-2">
                  {cameraSightings.map((s) => (
                    <div key={s.id} className="p-2 rounded border border-border bg-card flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {s.candidateFrameUrl && (
                          <img
                            src={s.candidateFrameUrl}
                            alt=""
                            className="h-10 w-10 rounded object-cover border"
                          />
                        )}
                        <div>
                          <span className="text-xs font-semibold text-foreground block">{s.personName}</span>
                          <span className="text-[10px] text-muted-foreground">{s.caseNumber} · {new Date(s.detectedAt).toLocaleTimeString()}</span>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px]',
                          s.confidenceBand === 'high' ? 'border-emerald-500 text-emerald-500' : 'border-amber-500 text-amber-500',
                        )}
                      >
                        {Math.round(s.fusedRank * 100)}% Match
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 5: RECORDING & PLAYBACK ================= */}
        {activeTab === 'recording' && (
          <div className="space-y-4">
            <div className="p-3 rounded-lg border border-border bg-card space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground">Recording Mode</span>
                <Badge variant="outline" className="uppercase font-mono text-[10px]">
                  {camera.recordPolicy?.mode || 'continuous'}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Continuous 24/7 rolling ring buffer stored across edge NVMe cache with 30-day retention.
              </p>
            </div>

            {/* 24h Timeline Scrubber */}
            <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground">Timeline Scrubber (Last 24 Hours)</span>
                <span className="text-[10px] text-muted-foreground font-mono">00:00 - 24:00</span>
              </div>

              <div className="h-6 w-full rounded bg-muted/80 relative overflow-hidden flex items-center cursor-pointer border border-border">
                {/* Continuous green recorded strip */}
                <div className="h-full w-full bg-emerald-500/30 relative flex">
                  {/* Amber sighting/motion segment markers */}
                  <span className="absolute top-0 bottom-0 left-[25%] w-2 bg-amber-500" title="Motion Event 06:00" />
                  <span className="absolute top-0 bottom-0 left-[38%] w-3 bg-amber-500" title="Possible Match Sighting 09:18" />
                  <span className="absolute top-0 bottom-0 left-[62%] w-1.5 bg-amber-500" title="Motion Event 14:50" />
                </div>
                {/* Playhead */}
                <div className="absolute top-0 bottom-0 left-[38%] w-0.5 bg-foreground z-10" />
              </div>

              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-500/50" /> Recorded footage
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded bg-amber-500" /> Sighting / Motion event
                </span>
              </div>
            </div>

            <div className="p-3 rounded-lg border border-border bg-card space-y-1 text-xs">
              <span className="font-semibold text-foreground">Storage Quota</span>
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>Usage: 412 GB / 1000 GB</span>
                <span>41.2%</span>
              </div>
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full w-[41.2%] bg-primary" />
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 6: SETTINGS ================= */}
        {activeTab === 'settings' && (
          <div className="space-y-4">
            <div className="space-y-2 text-xs">
              <Label htmlFor="cam-code" className="text-xs">Camera Code</Label>
              <Input id="cam-code" value={camera.cameraCode || camera.id} disabled className="font-mono text-xs" />
            </div>

            <div className="space-y-2 text-xs">
              <Label htmlFor="cam-name" className="text-xs">Human-Readable Name</Label>
              <Input
                id="cam-name"
                value={camera.name}
                onChange={(e) => updateCamera(camera.id, { name: e.target.value })}
                className="text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="space-y-1">
                <Label className="text-xs">Latitude</Label>
                <Input
                  value={camera.latitude ?? camera.coords?.[0] ?? ''}
                  disabled
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Longitude</Label>
                <Input
                  value={camera.longitude ?? camera.coords?.[1] ?? ''}
                  disabled
                  className="font-mono text-xs"
                />
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Optical Heading (Degrees)</Label>
                <span className="font-mono text-xs">{camera.heading ?? 0}°</span>
              </div>
              <Slider
                min={0}
                max={359}
                step={1}
                value={[camera.heading ?? 0]}
                onValueChange={(val) => updateCamera(camera.id, { heading: val[0] })}
              />
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Field of View Angle</Label>
                <span className="font-mono text-xs">{camera.fovDegrees ?? 75}°</span>
              </div>
              <Slider
                min={45}
                max={120}
                step={5}
                value={[camera.fovDegrees ?? 75]}
                onValueChange={(val) => updateCamera(camera.id, { fovDegrees: val[0] })}
              />
            </div>

            {/* Ingest Credentials */}
            <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-1 text-xs">
              <span className="font-semibold text-foreground">RTSP / ONVIF Ingest Credentials</span>
              <Input
                value={camera.rtspUrl || 'rtsp://user:••••••••@edge.sentinel.internal:554/live'}
                disabled
                className="font-mono text-[11px]"
              />
            </div>

            {/* Delete Camera with Confirmation */}
            <div className="pt-2 border-t border-border">
              {isDeleting ? (
                <div className="p-3 rounded-lg border border-rose-500/30 bg-rose-500/10 space-y-2">
                  <span className="text-xs font-semibold text-rose-500 block">
                    Confirm deletion of {camera.cameraCode || camera.id}?
                  </span>
                  <p className="text-[11px] text-muted-foreground">
                    This will remove the camera from active surveillance, flush associated frame caches, and preserve historical sighting audit logs.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={handleDelete}
                    >
                      Yes, delete camera
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setIsDeleting(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs text-rose-500 border-rose-500/30 hover:bg-rose-500/10 gap-1.5"
                  onClick={() => setIsDeleting(true)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete camera from fleet
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
