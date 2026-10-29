'use client';

import React, { useState, useEffect } from 'react';
import { cameraService } from '@/services/camera.service';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Activity,
  HardDrive,
  Cpu,
  Server,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  Sliders,
  RotateCw,
  TrendingDown,
  Layers,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';

export default function BandwidthBudgetPage() {
  const [report, setReport] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Estimator Calculator State
  const [calcCameras, setCalcCameras] = useState<number>(48);
  const [calcBitrateKbps, setCalcBitrateKbps] = useState<number>(2500);
  const [calcRecordMode, setCalcRecordMode] = useState<string>('continuous');
  const [calcRetentionDays, setCalcRetentionDays] = useState<number>(30);
  const [estimate, setEstimate] = useState<any>(null);

  useEffect(() => {
    loadReport();
  }, []);

  const loadReport = async () => {
    setIsLoading(true);
    try {
      const data = await cameraService.getBandwidthReport();
      setReport(data);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    cameraService
      .estimateBandwidth({
        cameraCount: calcCameras,
        avgBitrateKbps: calcBitrateKbps,
        recordMode: calcRecordMode,
        retentionDays: calcRetentionDays,
      })
      .then((est) => setEstimate(est));
  }, [calcCameras, calcBitrateKbps, calcRecordMode, calcRetentionDays]);

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link href="/cameras">
            <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs">
              <ChevronLeft className="h-3.5 w-3.5" /> Camera Fleet
            </Button>
          </Link>
          <div className="h-4 w-px bg-border" />
          <div>
            <h1 className="text-xl font-bold tracking-tight">Bandwidth Budget & Ingest Capacity Planner</h1>
            <p className="text-xs text-muted-foreground">
              Monitor real-time MediaMTX node loads, forecast storage requirements, and optimize edge stream bitrates
            </p>
          </div>
        </div>

        <Button size="sm" variant="outline" onClick={loadReport} className="h-8 gap-1 text-xs">
          <RotateCw className="h-3.5 w-3.5" /> Refresh Live Metrics
        </Button>
      </div>

      {/* Multi-Node Live Ingest Load Gauges */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {report?.nodesSummary?.map((node: any) => {
          const isOverloaded = node.warning;
          return (
            <Card
              key={node.nodeId}
              className={`border transition-all ${
                isOverloaded ? 'border-red-500/80 bg-red-950/10' : 'bg-card'
              }`}
            >
              <CardHeader className="p-4 border-b bg-muted/20 flex flex-row items-center justify-between pb-3">
                <div className="flex items-center gap-2">
                  <Server className={`h-4 w-4 ${isOverloaded ? 'text-red-400' : 'text-cyan-400'}`} />
                  <div>
                    <CardTitle className="text-xs font-semibold">{node.nodeName}</CardTitle>
                    <span className="text-[10px] text-muted-foreground font-mono">{node.nodeId}</span>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={`font-mono text-[10px] ${
                    isOverloaded
                      ? 'border-red-500 text-red-400 bg-red-950/40'
                      : 'border-emerald-500 text-emerald-400 bg-emerald-950/40'
                  }`}
                >
                  {isOverloaded ? 'CAPACITY WARNING' : 'NOMINAL LOAD'}
                </Badge>
              </CardHeader>
              <CardContent className="p-4 space-y-3 font-mono text-xs">
                {/* Active Streams */}
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-muted-foreground font-sans">Active Streams:</span>
                    <span className="font-bold text-foreground">
                      {node.activeStreams} / {node.maxStreams} Streams
                    </span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      style={{ width: `${Math.min(100, (node.activeStreams / node.maxStreams) * 100)}%` }}
                      className={`h-full ${isOverloaded ? 'bg-red-500' : 'bg-cyan-500'}`}
                    />
                  </div>
                </div>

                {/* Ingress Throughput */}
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-muted-foreground font-sans">Ingress Bandwidth:</span>
                    <span className="font-bold text-foreground">
                      {node.currentBitrateMbps} / {node.maxBitrateMbps} Mbps ({node.utilizationPercent}%)
                    </span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      style={{ width: `${node.utilizationPercent}%` }}
                      className={`h-full ${isOverloaded ? 'bg-red-500' : 'bg-emerald-500'}`}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Interactive Budget Estimator Tool */}
      <Card className="border">
        <CardHeader className="p-4 border-b bg-muted/20">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                <Sliders className="h-4 w-4 text-cyan-400" />
                Capacity Estimator & Bandwidth Calculator
              </CardTitle>
              <CardDescription className="text-[11px]">
                Simulate network consumption and storage footprint based on camera count and encoding profiles
              </CardDescription>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-cyan-400 font-mono bg-cyan-950/40 border border-cyan-500/30 px-2 py-0.5 rounded">
              <TrendingDown className="h-3.5 w-3.5" />
              <span>50%+ Savings with 12-15 FPS Policy</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            {/* Camera Count */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-muted-foreground">Camera Count:</span>
                <span className="font-bold font-mono">{calcCameras}</span>
              </div>
              <Slider
                value={[calcCameras]}
                min={4}
                max={200}
                step={2}
                onValueChange={([v]) => setCalcCameras(v)}
              />
            </div>

            {/* Average Bitrate */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-muted-foreground">Average Bitrate:</span>
                <span className="font-bold font-mono">{(calcBitrateKbps / 1024).toFixed(1)} Mbps</span>
              </div>
              <Slider
                value={[calcBitrateKbps]}
                min={500}
                max={8000}
                step={250}
                onValueChange={([v]) => setCalcBitrateKbps(v)}
              />
            </div>

            {/* Recording Mode */}
            <div className="space-y-1.5">
              <span className="text-muted-foreground block text-[11px]">Recording Mode:</span>
              <Select value={calcRecordMode} onValueChange={setCalcRecordMode}>
                <SelectTrigger className="h-8 text-xs bg-muted/40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="continuous">Continuous (100% Duty)</SelectItem>
                  <SelectItem value="motion">Motion Gated (~35% Duty)</SelectItem>
                  <SelectItem value="event_only">Detections Only (~15% Duty)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Retention Days */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-muted-foreground">Retention Window:</span>
                <span className="font-bold font-mono">{calcRetentionDays} Days</span>
              </div>
              <Slider
                value={[calcRetentionDays]}
                min={7}
                max={180}
                step={7}
                onValueChange={([v]) => setCalcRetentionDays(v)}
              />
            </div>
          </div>

          {/* Calculator Output Cards */}
          {estimate && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 text-center font-mono">
              <div className="p-3 bg-muted/30 rounded border">
                <span className="text-[10px] text-muted-foreground block mb-0.5">TOTAL INGRESS</span>
                <span className="text-lg font-bold text-cyan-400">
                  {estimate.totalIngressMbps} Mbps
                </span>
                <span className="text-[10px] text-muted-foreground block">
                  ({estimate.totalIngressGbps} Gbps)
                </span>
              </div>

              <div className="p-3 bg-muted/30 rounded border">
                <span className="text-[10px] text-muted-foreground block mb-0.5">DAILY STORAGE</span>
                <span className="text-lg font-bold text-foreground">
                  {estimate.dailyStorageGb} GB/day
                </span>
                <span className="text-[10px] text-muted-foreground block">
                  ({estimate.dailyStorageTb} TB/day)
                </span>
              </div>

              <div className="p-3 bg-muted/30 rounded border">
                <span className="text-[10px] text-muted-foreground block mb-0.5">TOTAL ARCHIVE</span>
                <span className="text-lg font-bold text-emerald-400">
                  {estimate.totalRetentionStorageTb} TB
                </span>
                <span className="text-[10px] text-muted-foreground block">
                  Across {estimate.retentionDays} Days
                </span>
              </div>

              <div className="p-3 bg-muted/30 rounded border">
                <span className="text-[10px] text-muted-foreground block mb-0.5">RECOMMENDED NODES</span>
                <span className="text-lg font-bold text-foreground">
                  {estimate.recommendedNodesCount} Nodes
                </span>
                <span className="text-[10px] text-muted-foreground block">
                  MediaMTX Ingest Cluster
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Camera Fleet Bandwidth Audit Table */}
      <Card className="border">
        <CardHeader className="p-4 border-b bg-muted/20">
          <CardTitle className="text-xs">Live Stream Bandwidth Audit & Storage Footprint</CardTitle>
          <CardDescription className="text-[11px]">
            Per-camera ingress bitrate, assigned MediaMTX node, and monthly MinIO storage utilization
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="text-xs">
                <TableHead>Camera ID & Title</TableHead>
                <TableHead>Assigned Node</TableHead>
                <TableHead>Codec / FPS</TableHead>
                <TableHead>Ingress Bitrate</TableHead>
                <TableHead>Daily Growth</TableHead>
                <TableHead>Monthly Archive</TableHead>
                <TableHead>Record Mode</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="text-xs font-mono">
              {report?.cameraBreakdown?.map((cam: any) => (
                <TableRow key={cam.cameraId}>
                  <TableCell className="font-sans font-medium">
                    <Link href={`/cameras/${cam.cameraId}`} className="hover:text-cyan-400">
                      {cam.name}
                    </Link>
                    <span className="block text-[10px] text-muted-foreground font-mono">{cam.cameraId}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {cam.assignedNode}
                    </Badge>
                  </TableCell>
                  <TableCell className="uppercase">
                    {cam.codec} • {cam.fps} FPS
                  </TableCell>
                  <TableCell className="font-bold">{cam.bitrateKbps} kbps</TableCell>
                  <TableCell>{cam.dailyStorageGb} GB</TableCell>
                  <TableCell className="text-foreground">{cam.monthlyStorageGb} GB</TableCell>
                  <TableCell className="capitalize text-muted-foreground font-sans">
                    {cam.recordMode}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
