'use client';

import React, { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  Zap,
  TrendingDown,
  CheckCircle2,
  Server,
  Layers,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface BandwidthHealthSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BandwidthHealthSheet({ open, onOpenChange }: BandwidthHealthSheetProps) {
  const [appliedOptimization1, setAppliedOptimization1] = useState(false);
  const [appliedOptimization2, setAppliedOptimization2] = useState(false);

  const nodes = [
    { id: 'node-01', name: 'edge-worker-01 (North)', streams: 42, bandwidthMbps: 160, cpuUsage: 42, ramGb: '14.2 / 32 GB', status: 'healthy', errors: 0 },
    { id: 'node-02', name: 'edge-worker-02 (Central)', streams: 40, bandwidthMbps: 155, cpuUsage: 39, ramGb: '13.8 / 32 GB', status: 'healthy', errors: 0 },
    { id: 'node-03', name: 'edge-worker-03 (South)', streams: 42, bandwidthMbps: 167, cpuUsage: 45, ramGb: '15.1 / 32 GB', status: 'healthy', errors: 0 },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto p-6 space-y-6">
        <SheetHeader className="space-y-1">
          <SheetTitle className="text-lg font-bold tracking-tight flex items-center gap-2">
            <Activity className="h-5 w-5 text-emerald-500" />
            Fleet Bandwidth & Ingestion Health
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            Real-time telemetry across distributed media workers, edge transcoders, and persistent storage retention.
          </SheetDescription>
        </SheetHeader>

        {/* Fleet KPI Summary Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="p-3 rounded-lg border border-border bg-card space-y-1">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Zap className="h-3.5 w-3.5 text-primary" /> Total Ingest
            </span>
            <span className="text-xl font-mono font-bold text-foreground block">
              482 <span className="text-xs font-normal text-muted-foreground">Mbps</span>
            </span>
            <span className="text-[10px] text-emerald-500 font-medium">96.4% Efficiency</span>
          </div>

          <div className="p-3 rounded-lg border border-border bg-card space-y-1">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Server className="h-3.5 w-3.5 text-emerald-500" /> Edge Nodes
            </span>
            <span className="text-xl font-mono font-bold text-emerald-500 block">
              3 / 3
            </span>
            <span className="text-[10px] text-muted-foreground">All nodes active</span>
          </div>

          <div className="p-3 rounded-lg border border-border bg-card space-y-1">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <HardDrive className="h-3.5 w-3.5 text-primary" /> Written Today
            </span>
            <span className="text-xl font-mono font-bold text-foreground block">
              1.24 <span className="text-xs font-normal text-muted-foreground">TB</span>
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">NVMe Rolling Ring</span>
          </div>

          <div className="p-3 rounded-lg border border-border bg-card space-y-1">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <TrendingDown className="h-3.5 w-3.5 text-primary" /> Monthly Est.
            </span>
            <span className="text-xl font-mono font-bold text-foreground block">
              $340 <span className="text-xs font-normal text-muted-foreground">/mo</span>
            </span>
            <span className="text-[10px] text-emerald-500 font-medium">-18% vs uncompressed</span>
          </div>
        </div>

        {/* Node Breakdown Table */}
        <div className="space-y-2">
          <span className="text-xs font-semibold text-foreground uppercase tracking-wider block">
            Media Ingest Nodes (3 Edge Clusters)
          </span>
          <div className="rounded-lg border border-border overflow-hidden">
            <Table className="text-xs">
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="text-[11px]">Node</TableHead>
                  <TableHead className="text-[11px]">Streams</TableHead>
                  <TableHead className="text-[11px]">Bandwidth</TableHead>
                  <TableHead className="text-[11px]">CPU</TableHead>
                  <TableHead className="text-[11px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {nodes.map((node) => (
                  <TableRow key={node.id}>
                    <TableCell className="font-mono text-xs font-medium">
                      <div>
                        <span>{node.id}</span>
                        <span className="text-[10px] text-muted-foreground block font-sans">{node.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono">{node.streams}</TableCell>
                    <TableCell className="font-mono">{node.bandwidthMbps} Mbps</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <span className="font-mono text-[11px]">{node.cpuUsage}%</span>
                        <div className="h-1 w-16 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary"
                            style={{ width: `${node.cpuUsage}%` }}
                          />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                        Active
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Fleet Optimization Suggestions */}
        <div className="space-y-3">
          <span className="text-xs font-semibold text-foreground uppercase tracking-wider block">
            Autonomous Optimization Recommendations
          </span>

          {/* Recommendation 1 */}
          <div className="p-3 rounded-lg border border-border bg-muted/10 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  Motion-Triggered 4K Ingest Switch
                </span>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  5 cameras streaming 4K continuous have observed 0 motion over the past 48 hours.
                  Switching to motion-triggered recording saves <span className="font-semibold text-foreground font-mono">32 GB / day</span>.
                </p>
              </div>
              <Button
                size="sm"
                variant={appliedOptimization1 ? 'outline' : 'default'}
                className="h-7 text-xs shrink-0"
                onClick={() => setAppliedOptimization1(true)}
                disabled={appliedOptimization1}
              >
                {appliedOptimization1 ? (
                  <span className="flex items-center gap-1 text-emerald-500">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Applied
                  </span>
                ) : (
                  'Apply policy'
                )}
              </Button>
            </div>
          </div>

          {/* Recommendation 2 */}
          <div className="p-3 rounded-lg border border-border bg-muted/10 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Cpu className="h-4 w-4 text-primary" />
                  H.265 Edge Transcoding Activation
                </span>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Activate NVENC hardware H.265 transcoding on 3 edge nodes to reduce ingress bandwidth by <span className="font-semibold text-foreground font-mono">38%</span> without perceptual fidelity loss.
                </p>
              </div>
              <Button
                size="sm"
                variant={appliedOptimization2 ? 'outline' : 'default'}
                className="h-7 text-xs shrink-0"
                onClick={() => setAppliedOptimization2(true)}
                disabled={appliedOptimization2}
              >
                {appliedOptimization2 ? (
                  <span className="flex items-center gap-1 text-emerald-500">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Applied
                  </span>
                ) : (
                  'Apply policy'
                )}
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
