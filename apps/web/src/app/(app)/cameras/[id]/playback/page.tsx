'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { Camera } from '@/types';
import {
  cameraService,
  CameraTimeline,
  TimelineInterval,
  TimelineGap,
  MotionMarker,
  ExportClipResponse,
} from '@/services/camera.service';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  ChevronLeft,
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  FastForward,
  Rewind,
  Clock,
  Download,
  ShieldCheck,
  Calendar,
  Layers,
  ChevronRight,
  AlertTriangle,
  FileVideo,
  CheckCircle2,
  ExternalLink,
  Copy,
  EyeOff,
  Flame,
} from 'lucide-react';
import Link from 'next/link';

export default function CameraPlaybackPage() {
  const params = useParams();
  const id = params?.id as string;

  const [camera, setCamera] = useState<Camera | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);

  // Time window: Default last 1 hour
  const [windowDurationSec, setWindowDurationSec] = useState<number>(3600);
  const [currentTimeSec, setCurrentTimeSec] = useState<number>(1800); // 30 mins into window

  // Timeline & Gaps
  const [timeline, setTimeline] = useState<CameraTimeline | null>(null);
  const [isLoadingTimeline, setIsLoadingTimeline] = useState<boolean>(true);

  // Export Modal & Parameters
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [clipStartSec, setClipStartSec] = useState<number>(1500);
  const [clipEndSec, setClipEndSec] = useState<number>(2100);
  const [faceBlur, setFaceBlur] = useState<boolean>(true);
  const [watermark, setWatermark] = useState<boolean>(true);
  const [exportPurpose, setExportPurpose] = useState<string>('Official Investigation / Evidence Custody');
  const [caseId, setCaseId] = useState<string>('case_2026_084');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportResult, setExportResult] = useState<ExportClipResponse | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Video Element Ref
  const videoRef = useRef<HTMLVideoElement>(null);

  // Window bounds in absolute ISO time
  const { windowStart, windowEnd } = useMemo(() => {
    const end = new Date();
    const start = new Date(end.getTime() - windowDurationSec * 1000);
    return { windowStart: start, windowEnd: end };
  }, [windowDurationSec]);

  // Load camera & timeline
  useEffect(() => {
    if (!id) return;
    cameraService.getById(id).then((cam) => {
      if (cam) setCamera(cam);
    });

    setIsLoadingTimeline(true);
    cameraService
      .getTimeline(id, windowStart.toISOString(), windowEnd.toISOString())
      .then((tl) => {
        setTimeline(tl);
        setIsLoadingTimeline(false);
      })
      .catch(() => {
        setIsLoadingTimeline(false);
      });
  }, [id, windowStart, windowEnd]);

  // Playback timer ticker
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setCurrentTimeSec((prev) => {
        if (prev >= windowDurationSec) {
          setIsPlaying(false);
          return windowDurationSec;
        }
        return prev + 1 * playbackSpeed;
      });
    }, 1000 / playbackSpeed);

    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, windowDurationSec]);

  // Synchronize native video speed if available
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackSpeed;
      if (isPlaying) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying, playbackSpeed]);

  const formatSecToClock = (sec: number) => {
    const absTime = new Date(windowStart.getTime() + sec * 1000);
    return absTime.toISOString().slice(11, 19) + ' UTC';
  };

  const handleExecuteExport = async () => {
    if (!id) return;
    setIsExporting(true);
    try {
      const fromIso = new Date(windowStart.getTime() + clipStartSec * 1000).toISOString();
      const toIso = new Date(windowStart.getTime() + clipEndSec * 1000).toISOString();

      const res = await cameraService.exportClip(id, {
        from: fromIso,
        to: toIso,
        faceBlur,
        watermark,
        purpose: exportPurpose,
        caseId,
      });

      setExportResult(res);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyLink = () => {
    if (exportResult?.downloadUrl) {
      navigator.clipboard.writeText(exportResult.downloadUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  // Convert timeline gaps into visual % positions
  const visualGaps = useMemo(() => {
    if (!timeline?.gaps || timeline.gaps.length === 0) return [];
    const totalMs = windowDurationSec * 1000;
    const startMs = windowStart.getTime();

    return timeline.gaps.map((g, idx) => {
      const gStartMs = new Date(g.start).getTime();
      const gEndMs = new Date(g.end).getTime();

      const leftPercent = Math.max(0, Math.min(100, ((gStartMs - startMs) / totalMs) * 100));
      const widthPercent = Math.max(0.5, Math.min(100 - leftPercent, ((gEndMs - gStartMs) / totalMs) * 100));

      return {
        ...g,
        id: `gap_${idx}`,
        leftPercent,
        widthPercent,
      };
    });
  }, [timeline, windowStart, windowDurationSec]);

  // Convert motion markers into visual % positions
  const visualMotionMarkers = useMemo(() => {
    if (!timeline?.motionMarkers || timeline.motionMarkers.length === 0) return [];
    const totalMs = windowDurationSec * 1000;
    const startMs = windowStart.getTime();

    return timeline.motionMarkers.map((m, idx) => {
      const mTimeMs = new Date(m.time).getTime();
      const leftPercent = Math.max(0, Math.min(100, ((mTimeMs - startMs) / totalMs) * 100));
      return {
        ...m,
        id: `m_${idx}`,
        leftPercent,
      };
    });
  }, [timeline, windowStart, windowDurationSec]);

  const currentSegment = useMemo(() => {
    if (!timeline?.coveredIntervals) return null;
    const targetMs = windowStart.getTime() + currentTimeSec * 1000;
    return timeline.coveredIntervals.find((seg) => {
      const s = new Date(seg.start).getTime();
      const e = new Date(seg.end).getTime();
      return targetMs >= s && targetMs <= e;
    });
  }, [timeline, windowStart, currentTimeSec]);

  const isInGap = useMemo(() => {
    if (!timeline?.gaps) return false;
    const targetMs = windowStart.getTime() + currentTimeSec * 1000;
    return timeline.gaps.some((g) => {
      const s = new Date(g.start).getTime();
      const e = new Date(g.end).getTime();
      return targetMs >= s && targetMs <= e;
    });
  }, [timeline, windowStart, currentTimeSec]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/cameras/${id || ''}`}>
            <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs">
              <ChevronLeft className="h-3.5 w-3.5" /> Back to Camera
            </Button>
          </Link>
          <div className="h-4 w-px bg-border" />
          <div>
            <h1 className="text-lg font-bold tracking-tight">
              Archival Investigation Playback — {camera?.name || id}
            </h1>
            <p className="text-xs text-muted-foreground font-mono">
              Scrub recorded fMP4 segments with seamless discontinuity handling & evidentiary chain of custody
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs text-cyan-400 border-cyan-500/40">
            Window: {windowStart.toISOString().slice(11, 19)} — {windowEnd.toISOString().slice(11, 19)} UTC
          </Badge>
          <Button
            size="sm"
            onClick={() => setIsExportModalOpen(true)}
            className="h-8 text-xs bg-cyan-600 hover:bg-cyan-500 text-white gap-1.5"
          >
            <Download className="h-3.5 w-3.5" /> Export Evidentiary Clip
          </Button>
        </div>
      </div>

      {/* Main Player Viewport */}
      <Card className="overflow-hidden border bg-black shadow-2xl relative">
        <div className="relative aspect-video w-full bg-zinc-950 flex items-center justify-center overflow-hidden">
          {isInGap ? (
            <div className="flex flex-col items-center justify-center p-8 text-center bg-red-950/20 border border-red-500/30 rounded-lg max-w-md mx-4">
              <AlertTriangle className="h-10 w-10 text-red-500 mb-2 animate-pulse" />
              <span className="text-sm font-bold text-red-400 font-mono tracking-wider">
                STREAM DISCONTINUITY (#EXT-X-DISCONTINUITY)
              </span>
              <p className="text-xs text-zinc-400 mt-1">
                Footage absent during this interval due to network partition or camera outage. The recorder auto-injected discontinuity markers.
              </p>
            </div>
          ) : (
            <img
              src={camera?.thumbnailUrl || 'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?auto=format&fit=crop&w=1200&q=80'}
              alt="Playback frame"
              className="h-full w-full object-cover opacity-85"
            />
          )}

          {/* Sighting Overlay simulation at timestamp ~1200 */}
          {Math.abs(currentTimeSec - 1200) < 45 && !isInGap && (
            <div className="absolute top-1/4 left-1/3 border-2 border-amber-400 bg-amber-500/10 p-2.5 rounded shadow-lg backdrop-blur-sm pointer-events-none">
              <span className="bg-black/90 px-2 py-0.5 rounded text-[10px] font-mono text-amber-300 font-bold border border-amber-400/50">
                POSSIBLE SIGHTING • 88.4% MATCH • MAYA LIN
              </span>
            </div>
          )}

          {/* Top HUD: Current Scrubber Timestamp */}
          <div className="absolute top-3 left-3 flex items-center gap-2 rounded bg-black/80 px-3 py-1 font-mono text-xs text-white border border-zinc-800 backdrop-blur-md">
            <Clock className="h-3.5 w-3.5 text-cyan-400" />
            <span>RECORDED: {formatSecToClock(currentTimeSec)}</span>
            {currentSegment?.tier === 'evidence' && (
              <Badge className="h-4 text-[9px] bg-amber-500/20 text-amber-300 border-amber-500/40">
                LEGAL HOLD
              </Badge>
            )}
          </div>

          {/* Top HUD Right: Speed & Motion Indicator */}
          <div className="absolute top-3 right-3 flex items-center gap-2">
            {currentSegment && (
              <div className="flex items-center gap-1 rounded bg-black/80 px-2 py-0.5 font-mono text-xs text-zinc-300 border border-zinc-800 backdrop-blur-md">
                <Flame className="h-3 w-3 text-cyan-400" />
                <span>Motion: {(currentSegment.motionScore * 100).toFixed(0)}%</span>
              </div>
            )}
            <div className="rounded bg-black/80 px-2 py-0.5 font-mono text-xs text-cyan-300 border border-zinc-800 backdrop-blur-md font-bold">
              {playbackSpeed}x
            </div>
          </div>
        </div>

        {/* Scrubber & Timeline Bar */}
        <div className="p-4 bg-zinc-950 border-t border-zinc-800 space-y-3">
          {/* Timeline Visual Track */}
          <div className="relative w-full h-12 bg-zinc-900 rounded-md border border-zinc-800 overflow-hidden px-2 flex items-center select-none">
            {/* Base Continuous Segment Slices */}
            <div className="absolute inset-0 flex gap-0.5 opacity-60 pointer-events-none">
              {Array.from({ length: 48 }, (_, i) => (
                <div
                  key={i}
                  className={`flex-1 h-full ${i % 8 === 0 ? 'bg-zinc-800' : 'bg-emerald-950/80 border-r border-emerald-500/20'}`}
                />
              ))}
            </div>

            {/* Gap-Aware Recording Disruption Zones with Striped Red Pattern */}
            {visualGaps.map((gap) => (
              <div
                key={gap.id}
                style={{
                  left: `${gap.leftPercent}%`,
                  width: `${gap.widthPercent}%`,
                }}
                className="absolute top-0 bottom-0 bg-[repeating-linear-gradient(45deg,#450a0a,#450a0a_6px,#7f1d1d_6px,#7f1d1d_12px)] border-x border-red-500/80 z-10 flex items-center justify-center cursor-help group"
                title={`Disruption Gap (${gap.durationSec}s): ${gap.reason}`}
              >
                <span className="text-[8px] font-mono text-red-300 font-bold rotate-90 select-none">
                  GAP
                </span>
                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col bg-black/95 border border-red-500/50 p-1.5 rounded text-[9px] font-mono text-white whitespace-nowrap z-30 shadow-xl">
                  <span className="text-red-400 font-bold">#EXT-X-DISCONTINUITY ({gap.durationSec}s)</span>
                  <span className="text-zinc-400">Reason: {gap.reason}</span>
                </div>
              </div>
            ))}

            {/* Motion Intensity Spikes */}
            {visualMotionMarkers.map((m) => (
              <div
                key={m.id}
                style={{
                  left: `${m.leftPercent}%`,
                  height: `${Math.max(20, m.score * 80)}%`,
                }}
                className="absolute bottom-0 w-0.5 bg-cyan-400/70 z-15 pointer-events-none"
              />
            ))}

            {/* Sighting Hit Markers */}
            {[
              { timeSec: 1200, label: 'Maya Lin (88%)', color: '#f59e0b' },
              { timeSec: 2850, label: 'Lucas Gomez (92%)', color: '#f59e0b' },
            ].map((marker, idx) => {
              const leftPercent = (marker.timeSec / windowDurationSec) * 100;
              return (
                <button
                  key={idx}
                  onClick={() => setCurrentTimeSec(marker.timeSec)}
                  style={{ left: `${leftPercent}%` }}
                  className="absolute top-0 bottom-0 w-1.5 z-20 hover:w-2.5 transition-all cursor-pointer group"
                  title={`${marker.label} at ${formatSecToClock(marker.timeSec)}`}
                >
                  <div style={{ backgroundColor: marker.color }} className="h-full w-full shadow-lg" />
                  <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block bg-black/95 border border-amber-500/50 px-2 py-0.5 text-[9px] font-mono text-amber-300 rounded whitespace-nowrap z-30 shadow-xl">
                    HIT: {marker.label}
                  </div>
                </button>
              );
            })}

            {/* Playhead Indicator Needle */}
            <div
              style={{ left: `${(currentTimeSec / windowDurationSec) * 100}%` }}
              className="absolute top-0 bottom-0 w-1 bg-cyan-400 z-25 shadow-lg shadow-cyan-500/80 pointer-events-none"
            >
              <div className="h-3 w-3 rounded-full bg-cyan-400 -translate-x-1 -translate-y-1.5 ring-2 ring-black" />
            </div>

            {/* Interactive Slider */}
            <Slider
              value={[currentTimeSec]}
              min={0}
              max={windowDurationSec}
              step={1}
              onValueChange={([val]) => setCurrentTimeSec(val)}
              className="relative z-30 cursor-pointer opacity-0 hover:opacity-100 transition-opacity"
            />
          </div>

          {/* Transport Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCurrentTimeSec((t) => Math.max(0, t - 60))}
                className="h-8 px-2 text-xs"
                title="Rewind 1 min"
              >
                <Rewind className="h-3.5 w-3.5" /> -1m
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCurrentTimeSec((t) => Math.max(0, t - 1))}
                className="h-8 px-2 text-xs font-mono"
                title="Step backward 1 frame"
              >
                -1f
              </Button>
              <Button
                size="sm"
                onClick={() => setIsPlaying(!isPlaying)}
                className="h-8 px-3.5 text-xs bg-cyan-600 hover:bg-cyan-500 text-white font-semibold shadow-md"
              >
                {isPlaying ? <Pause className="h-3.5 w-3.5 mr-1" /> : <Play className="h-3.5 w-3.5 mr-1" />}
                {isPlaying ? 'Pause' : 'Play'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCurrentTimeSec((t) => Math.min(windowDurationSec, t + 1))}
                className="h-8 px-2 text-xs font-mono"
                title="Step forward 1 frame"
              >
                +1f
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCurrentTimeSec((t) => Math.min(windowDurationSec, t + 60))}
                className="h-8 px-2 text-xs"
                title="Fast forward 1 min"
              >
                +1m <FastForward className="h-3.5 w-3.5" />
              </Button>

              {/* Speed Toggle Selector */}
              <div className="flex items-center rounded border border-zinc-800 bg-zinc-900 p-0.5 font-mono ml-2">
                {[0.5, 1, 2, 4, 8].map((sp) => (
                  <button
                    key={sp}
                    onClick={() => setPlaybackSpeed(sp)}
                    className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                      playbackSpeed === sp
                        ? 'bg-zinc-800 text-cyan-400 font-bold shadow-sm'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {sp}x
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Hit Jump Navigation */}
            <div className="flex items-center gap-1.5 font-mono text-[11px]">
              <span className="text-zinc-500 mr-1">JUMP TO CANDIDATE:</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCurrentTimeSec(1200)}
                className="h-7 px-2 text-[10px] text-amber-400 border-amber-500/40 hover:bg-amber-950/20"
              >
                Maya Lin (17:20:00)
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCurrentTimeSec(2850)}
                className="h-7 px-2 text-[10px] text-amber-400 border-amber-500/40 hover:bg-amber-950/20"
              >
                Lucas Gomez (17:47:30)
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Evidentiary Clip Export Modal */}
      <Dialog open={isExportModalOpen} onOpenChange={setIsExportModalOpen}>
        <DialogContent className="max-w-2xl bg-zinc-950 border-zinc-800 text-zinc-100">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-cyan-400" />
              Evidentiary Clip Splice & Chain of Custody Seal
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Cut exact timestamp chunks via stream-copy with SHA-256 cryptographic sealing and immutable audit trail.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Timestamp Scrub Range */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 space-y-3">
              <span className="text-xs font-semibold text-zinc-300 block">Time Span Selection</span>
              <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                <div>
                  <span className="text-zinc-400 block mb-1">
                    Clip Start: {formatSecToClock(clipStartSec)}
                  </span>
                  <Slider
                    value={[clipStartSec]}
                    min={0}
                    max={clipEndSec - 10}
                    step={10}
                    onValueChange={([val]) => setClipStartSec(val)}
                  />
                </div>
                <div>
                  <span className="text-zinc-400 block mb-1">
                    Clip End: {formatSecToClock(clipEndSec)}
                  </span>
                  <Slider
                    value={[clipEndSec]}
                    min={clipStartSec + 10}
                    max={windowDurationSec}
                    step={10}
                    onValueChange={([val]) => setClipEndSec(val)}
                  />
                </div>
              </div>
              <div className="text-[11px] text-zinc-500 flex justify-between font-mono">
                <span>Duration: {clipEndSec - clipStartSec} seconds</span>
                <span>Segments to concatenate: ~{Math.ceil((clipEndSec - clipStartSec) / 8)} chunks</span>
              </div>
            </div>

            {/* Privacy & Forensic Controls */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
                <div className="space-y-0.5">
                  <Label className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                    <EyeOff className="h-3.5 w-3.5 text-cyan-400" /> Privacy Face Blur
                  </Label>
                  <p className="text-[10px] text-zinc-400">
                    Blur bystanders outside authorized search scope
                  </p>
                </div>
                <Switch checked={faceBlur} onCheckedChange={setFaceBlur} />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
                <div className="space-y-0.5">
                  <Label className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-cyan-400" /> Custody Watermark
                  </Label>
                  <p className="text-[10px] text-zinc-400">
                    Embed UTC timestamp & legal custody header
                  </p>
                </div>
                <Switch checked={watermark} onCheckedChange={setWatermark} />
              </div>
            </div>

            {/* Audit & Legal Purpose */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium text-zinc-300">Case ID / Warrant Ref</Label>
                <Input
                  value={caseId}
                  onChange={(e) => setCaseId(e.target.value)}
                  className="mt-1 h-8 text-xs bg-zinc-900 border-zinc-700 font-mono"
                />
              </div>
              <div>
                <Label className="text-xs font-medium text-zinc-300">Investigation Purpose</Label>
                <Input
                  value={exportPurpose}
                  onChange={(e) => setExportPurpose(e.target.value)}
                  className="mt-1 h-8 text-xs bg-zinc-900 border-zinc-700"
                />
              </div>
            </div>

            {/* Watermark Visual Preview */}
            {watermark && (
              <div className="rounded border border-dashed border-zinc-800 bg-zinc-950 p-2.5 text-center text-[10px] font-mono text-zinc-400">
                <span className="text-cyan-400 font-bold block">
                  [WATERMARK PREVIEW]
                </span>
                SENTINEL SECURE ARCHIVE • CAM: {id} • CASE: {caseId} • TS: {formatSecToClock(clipStartSec)} - {formatSecToClock(clipEndSec)}
              </div>
            )}

            {/* Export Success Result Card */}
            {exportResult && (
              <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/20 p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-emerald-300 font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    PACKAGE SEALED: {exportResult.exportId}
                  </span>
                  <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/40">
                    {exportResult.segmentsCovered} SEGMENTS SPLICED
                  </Badge>
                </div>
                <div className="flex items-center justify-between bg-zinc-950/80 p-2 rounded border border-zinc-800 text-xs font-mono">
                  <span className="text-zinc-400 truncate max-w-[420px] text-[11px]">
                    {exportResult.downloadUrl}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleCopyLink}
                      className="h-7 text-xs px-2 gap-1"
                    >
                      <Copy className="h-3 w-3" />
                      {copiedLink ? 'Copied' : 'Copy'}
                    </Button>
                    <a href={exportResult.downloadUrl} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500 text-white gap-1">
                        <Download className="h-3 w-3" /> Download
                      </Button>
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExportModalOpen(false)}
              className="h-8 text-xs"
            >
              Close
            </Button>
            <Button
              size="sm"
              onClick={handleExecuteExport}
              disabled={isExporting}
              className="h-8 text-xs bg-cyan-600 hover:bg-cyan-500 text-white gap-1.5"
            >
              {isExporting ? <RotateCw className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
              {isExporting ? 'Splicing & Sealing...' : 'Generate Sealed Clip'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
