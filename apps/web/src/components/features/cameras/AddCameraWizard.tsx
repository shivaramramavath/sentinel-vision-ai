'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Camera, CameraSourceType } from '@/types';
import {
  cameraService,
  ConnectionProbeResult,
  MobilePairingResponse,
  OnvifDevice,
} from '@/services/camera.service';
import { SentinelMap, CameraFovLayer } from '@/components/features/map';
import { CameraPlayer } from './CameraPlayer';
import { MobileIngestionPanel } from './MobileIngestionPanel';
import {
  Cctv,
  Search,
  Smartphone,
  Webcam,
  Upload,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  QrCode,
  Copy,
  ExternalLink,
  ShieldCheck,
  Video,
  HardDrive,
} from 'lucide-react';

interface AddCameraWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCameraAdded?: (camera: Camera) => void;
}

export const AddCameraWizard: React.FC<AddCameraWizardProps> = ({
  open,
  onOpenChange,
  onCameraAdded,
}) => {
  const [activeTab, setActiveTab] = useState<string>('cctv');

  // CCTV Form State
  const [cctvName, setCctvName] = useState('North Gate Entrance');
  const [cctvRtspUrl, setCctvRtspUrl] = useState('rtsp://192.168.1.120:554/live/ch0');
  const [cctvSite, setCctvSite] = useState('Terminal 1');
  const [cctvCoords, setCctvCoords] = useState<[number, number]>([78.4867, 17.3850]);
  const [cctvHeading, setCctvHeading] = useState(90);
  const [cctvFov, setCctvFov] = useState(75);
  const [cctvSampleFps, setCctvSampleFps] = useState(2.0);
  const [cctvMinConf, setCctvMinConf] = useState(0.65);
  const [cctvRecordMode, setCctvRecordMode] = useState<'continuous' | 'motion' | 'event_only'>('continuous');
  const [cctvRetentionDays, setCctvRetentionDays] = useState(30);
  const [consentConfirmed, setConsentConfirmed] = useState(false);

  // CCTV Probe State
  const [isProbing, setIsProbing] = useState(false);
  const [probeResult, setProbeResult] = useState<ConnectionProbeResult | null>(null);
  const [probeError, setProbeError] = useState<string | null>(null);

  // ONVIF Discovery State
  const [isDiscoveringOnvif, setIsDiscoveringOnvif] = useState(false);
  const [discoveredDevices, setDiscoveredDevices] = useState<OnvifDevice[]>([]);

  // Mobile Pairing State
  const [mobileName, setMobileName] = useState('Patrol Officer Bodycam');
  const [pairingData, setPairingData] = useState<MobilePairingResponse | null>(null);
  const [pairingCountdown, setPairingCountdown] = useState<number>(600); // 10 minutes
  const [isMobileConnected, setIsMobileConnected] = useState(false);
  const [isGeneratingPairing, setIsGeneratingPairing] = useState(false);

  // Local Webcam State
  const [webcamName, setWebcamName] = useState('Workstation Webcam Desk-01');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const webcamVideoRef = useRef<HTMLVideoElement | null>(null);

  // Upload Video State
  const [uploadName, setUploadName] = useState('Forensic Footage Simulation');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTime, setUploadTime] = useState(new Date().toISOString().slice(0, 16));
  const [uploadProgress, setUploadProgress] = useState(0);

  // Submission loading
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. Connection Probe Action
  const handleTestConnection = async () => {
    setIsProbing(true);
    setProbeResult(null);
    setProbeError(null);
    try {
      const res = await cameraService.testConnection(cctvRtspUrl);
      setProbeResult(res);
    } catch (err: any) {
      setProbeError(err.message || 'Connection test failed. Camera address unreachable.');
    } finally {
      setIsProbing(false);
    }
  };

  // 2. Discover ONVIF Action
  const handleDiscoverOnvif = async () => {
    setIsDiscoveringOnvif(true);
    try {
      const devices = await cameraService.discoverOnvif();
      setDiscoveredDevices(devices);
    } finally {
      setIsDiscoveringOnvif(false);
    }
  };

  // Select an ONVIF device to configure
  const handleSelectOnvifDevice = (dev: OnvifDevice) => {
    setCctvName(`${dev.manufacturer} - ${dev.model}`);
    setCctvRtspUrl(dev.rtspEndpoint);
    setActiveTab('cctv');
  };

  // 3. Initiate Mobile Pairing
  const handleStartMobilePairing = async () => {
    setIsGeneratingPairing(true);
    setIsMobileConnected(false);
    try {
      const res = await cameraService.requestPairing(mobileName, cctvSite);
      setPairingData(res);
      setPairingCountdown(600);
    } finally {
      setIsGeneratingPairing(false);
    }
  };

  // Mobile pairing timer countdown & live status poller
  useEffect(() => {
    if (!pairingData || isMobileConnected) return;

    const timer = setInterval(() => {
      setPairingCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          return 0;
        }
        return c - 1;
      });
    }, 1000);

    // Poll camera status or simulate mobile connection flip after 12s in mock mode
    const poller = setTimeout(() => {
      setIsMobileConnected(true);
    }, 12000);

    return () => {
      clearInterval(timer);
      clearTimeout(poller);
    };
  }, [pairingData, isMobileConnected]);

  // 4. Local Webcam Stream
  useEffect(() => {
    if (activeTab === 'webcam') {
      navigator.mediaDevices
        ?.getUserMedia({ video: { width: 1280, height: 720 }, audio: false })
        .then((stream) => {
          setLocalStream(stream);
          if (webcamVideoRef.current) {
            webcamVideoRef.current.srcObject = stream;
          }
        })
        .catch(() => {
          // Webcam unavailable or permission denied
        });
    } else {
      if (localStream) {
        localStream.getTracks().forEach((t) => t.stop());
        setLocalStream(null);
      }
    }
  }, [activeTab]);

  // Submit Registration
  const handleSubmitCctv = async () => {
    if (!consentConfirmed) return;
    setIsSubmitting(true);
    try {
      const created = await cameraService.createCamera({
        name: cctvName,
        locationName: cctvSite,
        sourceType: 'cctv_rtsp',
        rtspUrl: cctvRtspUrl,
        coordinates: cctvCoords,
        heading: cctvHeading,
        fovDegrees: cctvFov,
        aiPolicy: {
          enabled: true,
          sampleFps: cctvSampleFps,
          minDetectionConf: cctvMinConf,
        },
        recordPolicy: {
          mode: cctvRecordMode,
          segmentSec: 15,
          retentionDays: cctvRetentionDays,
          quality: 'original',
        },
        authorization: {
          consentConfirmed: true,
          authorizedBy: 'admin@sentinel.gov',
          purpose: 'Facility Surveillance & Missing Person Search',
        },
      });

      if (onCameraAdded) onCameraAdded(created);
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCountdown = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0 border-zinc-800 bg-zinc-950 text-zinc-100">
        <DialogHeader className="p-5 border-b border-zinc-800/80 bg-zinc-900/40">
          <div className="flex items-center gap-2">
            <Video className="h-5 w-5 text-cyan-400" />
            <DialogTitle className="text-base font-semibold">Sensor Ingestion Wizard</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-zinc-400">
            Onboard new surveillance cameras, network ONVIF units, field mobile phones, or forensic video feeds.
          </DialogDescription>
        </DialogHeader>

        <div className="p-5">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5 bg-zinc-900 p-1 mb-5">
              <TabsTrigger value="cctv" className="text-xs gap-1.5 data-[state=active]:bg-zinc-800">
                <Cctv className="h-3.5 w-3.5" /> CCTV / IP
              </TabsTrigger>
              <TabsTrigger value="onvif" className="text-xs gap-1.5 data-[state=active]:bg-zinc-800">
                <Search className="h-3.5 w-3.5" /> ONVIF Scan
              </TabsTrigger>
              <TabsTrigger value="mobile" className="text-xs gap-1.5 data-[state=active]:bg-zinc-800">
                <Smartphone className="h-3.5 w-3.5" /> Mobile Phone
              </TabsTrigger>
              <TabsTrigger value="webcam" className="text-xs gap-1.5 data-[state=active]:bg-zinc-800">
                <Webcam className="h-3.5 w-3.5" /> Webcam
              </TabsTrigger>
              <TabsTrigger value="upload" className="text-xs gap-1.5 data-[state=active]:bg-zinc-800">
                <Upload className="h-3.5 w-3.5" /> Upload Video
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: CCTV / RTSP */}
            <TabsContent value="cctv" className="space-y-5">
              {/* Phase C1: Camera-Side Settings Guidance Banner */}
              <div className="rounded-lg border border-cyan-500/30 bg-cyan-950/20 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-cyan-400" />
                    <span className="text-xs font-bold text-cyan-200">
                      Recommended Camera-Side Encoding Configuration (Phase C1 Policy)
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setCctvSampleFps(2.0);
                      setCctvMinConf(0.65);
                      setCctvRecordMode('continuous');
                      setCctvRetentionDays(30);
                    }}
                    className="h-6 text-[10px] border-cyan-500/50 text-cyan-300 hover:bg-cyan-950"
                  >
                    Apply Optimal Settings
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-zinc-300 font-mono">
                  <div className="p-2 rounded bg-black/40 border border-zinc-800">
                    <span className="text-cyan-400 font-bold block">Main Stream:</span>
                    <span>1080p @ 12-15 FPS • 2-4 Mbps VBR • GOP 1.5s</span>
                  </div>
                  <div className="p-2 rounded bg-black/40 border border-zinc-800">
                    <span className="text-cyan-400 font-bold block">Substream (for Wall Grid):</span>
                    <span>640x360 @ 5-10 FPS • 300-600 kbps VBR</span>
                  </div>
                </div>
                <p className="text-[10px] text-zinc-400">
                  <strong className="text-zinc-200">Why lower FPS?</strong> 12-15 FPS provides identical neural Re-ID feature extraction accuracy as 30 FPS while cutting streaming network bandwidth and storage overhead by &gt;50%.
                </p>
                <div className="flex flex-wrap gap-2 pt-1 text-[10px] font-sans text-zinc-400">
                  <span className="text-zinc-500">Vendor Guides:</span>
                  <span className="underline cursor-pointer hover:text-white" title="Configuration: Video > Main Stream > Bitrate Type: Variable > Frame Rate: 15 > I-Frame Interval: 30">Hikvision / ColorVu</span>
                  <span>•</span>
                  <span className="underline cursor-pointer hover:text-white" title="Setting: Camera > Video > Encode > Sub Stream: Enabled > 360p > 10fps">Dahua / WizSense</span>
                  <span>•</span>
                  <span className="underline cursor-pointer hover:text-white" title="Setting: Stream > Video Stream > Zipstream: Extreme > FPS: 15">Axis Communications</span>
                  <span>•</span>
                  <span className="underline cursor-pointer hover:text-white" title="Setting: Video Profile > WiseStream II > FPS: 15">Hanwha Wisenet</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Form Inputs */}
                <div className="space-y-3.5">
                  <div>
                    <Label className="text-xs font-medium text-zinc-300">Camera Name</Label>
                    <Input
                      value={cctvName}
                      onChange={(e) => setCctvName(e.target.value)}
                      className="mt-1 h-8 text-xs bg-zinc-900 border-zinc-700"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-medium text-zinc-300">RTSP Stream Address</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        value={cctvRtspUrl}
                        onChange={(e) => setCctvRtspUrl(e.target.value)}
                        placeholder="rtsp://user:pass@192.168.1.100:554/live"
                        className="h-8 text-xs font-mono bg-zinc-900 border-zinc-700"
                      />
                      <Button
                        size="sm"
                        onClick={handleTestConnection}
                        disabled={isProbing || !cctvRtspUrl}
                        className="h-8 text-xs bg-cyan-600 hover:bg-cyan-500 text-white shrink-0"
                      >
                        {isProbing ? <RotateCw className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                        Test Connection
                      </Button>
                    </div>
                    <span className="text-[10px] text-zinc-500">
                      RTSP credentials are encrypted with AES-256-GCM and never exposed in cleartext.
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-medium text-zinc-300">Site / Building</Label>
                      <Input
                        value={cctvSite}
                        onChange={(e) => setCctvSite(e.target.value)}
                        className="mt-1 h-8 text-xs bg-zinc-900 border-zinc-700"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-zinc-300">Recording Mode</Label>
                      <Select
                        value={cctvRecordMode}
                        onValueChange={(v: any) => setCctvRecordMode(v)}
                      >
                        <SelectTrigger className="mt-1 h-8 text-xs bg-zinc-900 border-zinc-700">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-zinc-700">
                          <SelectItem value="continuous">Continuous (100% duty)</SelectItem>
                          <SelectItem value="motion">Motion Only (~35% duty)</SelectItem>
                          <SelectItem value="event_only">Detections Only (~10% duty)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Retention Days & Storage Footprint Estimator */}
                  <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                        <HardDrive className="h-3.5 w-3.5 text-cyan-400" />
                        Storage Retention & Capacity Estimator
                      </Label>
                      <Badge variant="outline" className="text-[10px] text-cyan-400 border-cyan-500/40 font-mono">
                        {cctvRetentionDays} Days Retention
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-zinc-400">
                        <span>Retention Period</span>
                        <span>{cctvRetentionDays} days</span>
                      </div>
                      <Slider
                        value={[cctvRetentionDays]}
                        min={3}
                        max={90}
                        step={1}
                        onValueChange={([val]) => setCctvRetentionDays(val)}
                      />
                    </div>
                    {/* Live Calculated Footprint */}
                    {(() => {
                      const effectiveBitrate = probeResult?.bitrateKbps || 2048;
                      const modeDiscount = cctvRecordMode === 'continuous' ? 1.0 : cctvRecordMode === 'motion' ? 0.35 : 0.10;
                      const bytesPerDay = ((effectiveBitrate * 1000) / 8) * 86400 * modeDiscount;
                      const gbPerDay = bytesPerDay / (1024 * 1024 * 1024);
                      const totalGb = gbPerDay * cctvRetentionDays;
                      const formattedTotal = totalGb >= 1000 ? `${(totalGb / 1024).toFixed(2)} TB` : `${totalGb.toFixed(1)} GB`;

                      return (
                        <div className="rounded bg-zinc-950 p-2.5 border border-zinc-800/80 text-[11px] space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-zinc-400">Expected Total Storage:</span>
                            <span className="text-cyan-300 font-bold font-mono text-xs">{formattedTotal}</span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-zinc-500">
                            <span>Ingest Rate: {effectiveBitrate} kbps ({gbPerDay.toFixed(1)} GB/day)</span>
                            <span>Mode: {cctvRecordMode} (x{modeDiscount})</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* AI Policy */}
                  <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-zinc-200">AI Sampling & Detection</Label>
                      <Badge variant="outline" className="text-[10px] text-cyan-400 border-cyan-500/40 font-mono">
                        {cctvSampleFps} FPS • {Math.round(cctvMinConf * 100)}% Conf
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-zinc-400">
                        <span>Sampling Rate</span>
                        <span>{cctvSampleFps} FPS</span>
                      </div>
                      <Slider
                        value={[cctvSampleFps]}
                        min={1}
                        max={10}
                        step={1}
                        onValueChange={([val]) => setCctvSampleFps(val)}
                      />
                    </div>
                  </div>
                </div>

                {/* Probe Result Card */}
                <div className="flex flex-col rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
                  <span className="text-xs font-semibold text-zinc-300 mb-2">Live Connection Probe</span>
                  {probeResult ? (
                    <div className="space-y-3">
                      <div className="relative aspect-video rounded overflow-hidden bg-black flex items-center justify-center">
                        <img
                          src={probeResult.snapshotBase64 || 'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?auto=format&fit=crop&w=400&q=80'}
                          alt="Probe snapshot"
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute top-2 left-2 flex items-center gap-1 rounded bg-black/70 px-2 py-0.5 text-[10px] text-emerald-400 font-mono">
                          <CheckCircle2 className="h-3 w-3" /> STREAM REACHABLE
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                        <div className="bg-zinc-950 p-2 rounded">
                          <span className="text-zinc-500 block text-[10px]">Codec</span>
                          <span className="text-zinc-200 font-bold uppercase">{probeResult.codec}</span>
                        </div>
                        <div className="bg-zinc-950 p-2 rounded">
                          <span className="text-zinc-500 block text-[10px]">Resolution</span>
                          <span className="text-zinc-200 font-bold">{probeResult.width}x{probeResult.height}</span>
                        </div>
                        <div className="bg-zinc-950 p-2 rounded">
                          <span className="text-zinc-500 block text-[10px]">Framerate</span>
                          <span className="text-zinc-200 font-bold">{probeResult.fps} FPS</span>
                        </div>
                        <div className="bg-zinc-950 p-2 rounded">
                          <span className="text-zinc-500 block text-[10px]">Bitrate</span>
                          <span className="text-zinc-200 font-bold">{probeResult.bitrateKbps} kbps</span>
                        </div>
                      </div>

                      {probeResult.warning && (
                        <div className="flex items-start gap-2 p-2 rounded bg-amber-950/40 border border-amber-500/30 text-[11px] text-amber-300">
                          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                          <span>{probeResult.warning}</span>
                        </div>
                      )}
                    </div>
                  ) : probeError ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-red-400 gap-2">
                      <AlertTriangle className="h-8 w-8 text-red-500" />
                      <span className="text-xs font-semibold">{probeError}</span>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-zinc-500 border border-dashed border-zinc-800 rounded">
                      <Cctv className="h-8 w-8 mb-2 opacity-40" />
                      <span className="text-xs">Click &quot;Test Connection&quot; to probe RTSP resolution, codec, and snapshot.</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Mapcn Map Placement Preview (Heading / FOV Cone) */}
              <div className="rounded-lg border border-zinc-800 overflow-hidden">
                <div className="bg-zinc-900 px-3 py-2 border-b border-zinc-800 flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-300">Geographic Sensor Placement & FOV Cone</span>
                  <div className="flex items-center gap-3 text-[11px] text-zinc-400">
                    <span>Heading: {cctvHeading}°</span>
                    <span>FOV: {cctvFov}°</span>
                  </div>
                </div>
                <div className="h-[220px] w-full relative">
                  <SentinelMap
                    zoom={15}
                    center={[cctvCoords[0], cctvCoords[1]]}
                    controlsPosition="bottom-right"
                    showFullscreen={false}
                    className="h-full w-full"
                  >
                    <CameraFovLayer
                      cameras={[
                        {
                          id: 'preview_cam',
                          name: cctvName,
                          locationName: cctvSite,
                          zone: 'Zone A',
                          status: 'live',
                          peopleCount: 0,
                          fps: 30,
                          resolution: '1080p',
                          coords: [cctvCoords[1], cctvCoords[0]],
                          latitude: cctvCoords[1],
                          longitude: cctvCoords[0],
                          lastPing: 'now',
                          rtspUrl: cctvRtspUrl,
                          thumbnailUrl: '',
                          heading: cctvHeading,
                          fovDegrees: cctvFov,
                          range: 35,
                        },
                      ]}
                    />
                  </SentinelMap>
                </div>
                <div className="bg-zinc-900/60 p-2.5 flex flex-wrap items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5 font-mono text-[11px] text-zinc-400">
                    <span>Lng:</span>
                    <Input
                      type="number"
                      step="0.0001"
                      value={cctvCoords[0]}
                      onChange={(e) => setCctvCoords([parseFloat(e.target.value) || 0, cctvCoords[1]])}
                      className="h-6 w-20 text-[10px] bg-zinc-950 font-mono"
                    />
                    <span>Lat:</span>
                    <Input
                      type="number"
                      step="0.0001"
                      value={cctvCoords[1]}
                      onChange={(e) => setCctvCoords([cctvCoords[0], parseFloat(e.target.value) || 0])}
                      className="h-6 w-20 text-[10px] bg-zinc-950 font-mono"
                    />
                  </div>
                  <div className="flex-1 flex items-center gap-2">
                    <span className="text-zinc-400">Heading</span>
                    <Slider
                      value={[cctvHeading]}
                      min={0}
                      max={359}
                      step={5}
                      onValueChange={([val]) => setCctvHeading(val)}
                      className="flex-1"
                    />
                  </div>
                  <div className="flex-1 flex items-center gap-2">
                    <span className="text-zinc-400">FOV</span>
                    <Slider
                      value={[cctvFov]}
                      min={45}
                      max={120}
                      step={5}
                      onValueChange={([val]) => setCctvFov(val)}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>

              {/* Mandatory Statutory Consent */}
              <div className="flex items-start gap-2.5 rounded-lg border border-cyan-500/30 bg-cyan-950/20 p-3">
                <Checkbox
                  id="consent"
                  checked={consentConfirmed}
                  onCheckedChange={(c) => setConsentConfirmed(Boolean(c))}
                  className="mt-0.5 border-cyan-500 data-[state=checked]:bg-cyan-500 data-[state=checked]:text-black"
                />
                <div className="space-y-0.5">
                  <Label htmlFor="consent" className="text-xs font-semibold text-cyan-200 cursor-pointer">
                    Surveillance Authorization & Legal Basis Confirmation (Mandatory)
                  </Label>
                  <p className="text-[11px] text-zinc-400">
                    I certify that this camera is deployed in accordance with statutory jurisdiction, public safety mandate,
                    and authorized operational search directives. Output feeds strictly serve human verification queues.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="h-8 text-xs">
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSubmitCctv}
                  disabled={!consentConfirmed || isSubmitting}
                  className="h-8 text-xs bg-cyan-600 hover:bg-cyan-500 text-white"
                >
                  {isSubmitting ? <RotateCw className="h-3.5 w-3.5 animate-spin mr-1" /> : <ShieldCheck className="h-3.5 w-3.5 mr-1" />}
                  Register Camera
                </Button>
              </div>
            </TabsContent>

            {/* TAB 2: ONVIF DISCOVERY */}
            <TabsContent value="onvif" className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-zinc-200">Local Subnet Probe (WS-Discovery)</span>
                  <p className="text-[11px] text-zinc-400">Scan for ONVIF Profile S/T compliant cameras across the subnet.</p>
                </div>
                <Button
                  size="sm"
                  onClick={handleDiscoverOnvif}
                  disabled={isDiscoveringOnvif}
                  className="h-8 text-xs bg-cyan-600 hover:bg-cyan-500 text-white"
                >
                  {isDiscoveringOnvif ? <RotateCw className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Search className="h-3.5 w-3.5 mr-1.5" />}
                  Scan Network
                </Button>
              </div>

              {discoveredDevices.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {discoveredDevices.map((dev) => (
                    <div
                      key={dev.deviceId}
                      className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 space-y-2 hover:border-cyan-500/60 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-200">{dev.manufacturer}</span>
                        <Badge variant="outline" className="text-[10px] font-mono text-emerald-400 border-emerald-500/40">
                          {dev.ipAddress}
                        </Badge>
                      </div>
                      <div className="text-[11px] text-zinc-400 space-y-0.5">
                        <p>Model: {dev.model} (FW: {dev.firmware})</p>
                        <p className="font-mono text-[10px] text-zinc-500 truncate">{dev.rtspEndpoint}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleSelectOnvifDevice(dev)}
                        className="w-full h-7 text-xs"
                      >
                        Select & Configure
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center border border-dashed border-zinc-800 rounded-lg text-zinc-500">
                  <Search className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-xs">No scan performed yet. Click &quot;Scan Network&quot; to probe local CCTV hardware.</p>
                </div>
              )}
            </TabsContent>

            {/* TAB 3: MOBILE SELF-REGISTRATION & FLEET */}
            <TabsContent value="mobile" className="space-y-4">
              <MobileIngestionPanel
                onOpenLive={() => {
                  onOpenChange(false);
                }}
              />
            </TabsContent>

            {/* TAB 4: WEBCAM */}
            <TabsContent value="webcam" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs font-medium text-zinc-300">Webcam Label</Label>
                    <Input
                      value={webcamName}
                      onChange={(e) => setWebcamName(e.target.value)}
                      className="mt-1 h-8 text-xs bg-zinc-900 border-zinc-700"
                    />
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      if (onCameraAdded) {
                        onCameraAdded({
                          id: `cam_usb_${Date.now().toString(36)}`,
                          name: webcamName,
                          locationName: 'Local Workstation',
                          zone: 'Zone A',
                          status: 'live',
                          sourceType: 'usb_webcam',
                          peopleCount: 1,
                          fps: 30,
                          resolution: '1080p',
                          coords: [17.385, 78.4867],
                          lastPing: 'now',
                          rtspUrl: '',
                          thumbnailUrl: '',
                        });
                      }
                      onOpenChange(false);
                    }}
                    className="h-8 text-xs bg-cyan-600 hover:bg-cyan-500 text-white"
                  >
                    Register Workstation Webcam
                  </Button>
                </div>
                <div className="aspect-video bg-black rounded-lg overflow-hidden border border-zinc-800 flex items-center justify-center">
                  <video ref={webcamVideoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
                </div>
              </div>
            </TabsContent>

            {/* TAB 5: UPLOAD VIDEO */}
            <TabsContent value="upload" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs font-medium text-zinc-300">Footage Title / Camera Simulation</Label>
                    <Input
                      value={uploadName}
                      onChange={(e) => setUploadName(e.target.value)}
                      className="mt-1 h-8 text-xs bg-zinc-900 border-zinc-700"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-zinc-300">Original Incident Capture Time</Label>
                    <Input
                      type="datetime-local"
                      value={uploadTime}
                      onChange={(e) => setUploadTime(e.target.value)}
                      className="mt-1 h-8 text-xs bg-zinc-900 border-zinc-700"
                    />
                  </div>
                  <Button
                    size="sm"
                    disabled={!uploadFile}
                    onClick={() => {
                      setUploadProgress(100);
                      setTimeout(() => {
                        if (onCameraAdded) {
                          onCameraAdded({
                            id: `cam_file_${Date.now().toString(36)}`,
                            name: uploadName,
                            locationName: 'Forensic Video Archive',
                            zone: 'Zone A',
                            status: 'live',
                            sourceType: 'file_upload',
                            peopleCount: 2,
                            fps: 30,
                            resolution: '1080p',
                            coords: [17.385, 78.4867],
                            lastPing: 'Uploaded',
                            rtspUrl: '',
                            thumbnailUrl: '',
                          });
                        }
                        onOpenChange(false);
                      }, 600);
                    }}
                    className="h-8 text-xs bg-cyan-600 hover:bg-cyan-500 text-white"
                  >
                    Upload & Ingest Offline Video
                  </Button>
                </div>

                <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-zinc-800 rounded-lg text-center hover:border-zinc-700 transition-colors">
                  <Upload className="h-8 w-8 text-zinc-500 mb-2" />
                  <span className="text-xs font-medium text-zinc-300">Drag and drop MP4 / MKV video file</span>
                  <input
                    type="file"
                    accept="video/mp4,video/mkv,video/avi"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    className="mt-2 text-xs text-zinc-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-zinc-800 file:text-zinc-300 cursor-pointer"
                  />
                  {uploadFile && (
                    <span className="mt-2 text-[10px] text-cyan-400 font-mono">
                      Selected: {uploadFile.name} ({(uploadFile.size / (1024 * 1024)).toFixed(1)} MB)
                    </span>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};
