'use client';

import React from 'react';
import { AI_MODEL_REGISTRY } from '@/lib/model-registry';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Info, Cpu, Sparkles } from 'lucide-react';

interface ScoreBreakdownProps {
  scores: {
    face: number | null;
    reid: number;
    temporal: number;
    cameraPlausibility: number;
    fused: number;
  };
  compact?: boolean;
  className?: string;
  historicalPrecisionBand?: string;
}

export function ScoreBreakdown({
  scores,
  compact = false,
  className,
  historicalPrecisionBand,
}: ScoreBreakdownProps) {
  const formatScore = (val: number | null) => (val === null || isNaN(val) ? 'n/a' : `${Math.round(val * 100)}%`);

  const metrics = [
    {
      id: 'face',
      label: 'Face Biometrics',
      score: scores.face,
      model: `${AI_MODEL_REGISTRY.face.name} ${AI_MODEL_REGISTRY.face.version}`,
      description: AI_MODEL_REGISTRY.face.description,
    },
    {
      id: 'reid',
      label: 'Whole-Body Re-ID',
      score: scores.reid,
      model: `${AI_MODEL_REGISTRY.reid.name} ${AI_MODEL_REGISTRY.reid.version}`,
      description: AI_MODEL_REGISTRY.reid.description,
    },
    {
      id: 'temporal',
      label: 'Temporal Plausibility',
      score: scores.temporal,
      model: `${AI_MODEL_REGISTRY.spatiotemporal.name} ${AI_MODEL_REGISTRY.spatiotemporal.version}`,
      description: 'Transit timing relative to previous camera observation',
    },
    {
      id: 'camera',
      label: 'Camera Plausibility',
      score: scores.cameraPlausibility,
      model: 'Topology Graph',
      description: 'Physical corridor and pedestrian route connectivity',
    },
  ];

  if (compact) {
    return (
      <div className={cn('space-y-1.5', className)}>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground font-mono text-[11px]">Fused Score:</span>
          <span className="font-mono font-bold text-foreground">{formatScore(scores.fused)}</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {metrics.map((m) => (
            <div key={m.id} className="space-y-0.5">
              <div className="flex justify-between text-[9px] font-mono text-muted-foreground">
                <span className="truncate">{m.id.toUpperCase()}</span>
                <span>{formatScore(m.score)}</span>
              </div>
              <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary/70 rounded-full transition-all"
                  style={{ width: m.score !== null ? `${Math.round(m.score * 100)}%` : '0%' }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('rounded-xl border bg-card p-4 space-y-4 select-none', className)}>
      {/* Header with Fused Score & Calibration */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-xs font-semibold tracking-wider font-mono uppercase text-foreground">
              Algorithmic Evidence Breakdown
            </h4>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Calibrated fusion of 4 biometric and spatial models
          </p>
        </div>

        <div className="flex items-center gap-3">
          {historicalPrecisionBand && (
            <span className="text-[10px] text-muted-foreground font-mono border rounded px-1.5 py-0.5 bg-muted/40">
              {historicalPrecisionBand}
            </span>
          )}
          <div className="flex items-baseline gap-1.5 rounded-lg border bg-secondary/30 px-3 py-1">
            <span className="text-[10px] font-mono uppercase text-muted-foreground">Fused:</span>
            <span className="text-base font-bold font-mono text-foreground">
              {formatScore(scores.fused)}
            </span>
          </div>
        </div>
      </div>

      {/* 4 Model Bars (Neutral/Blue/Amber - No Green/Red) */}
      <div className="grid gap-3 sm:grid-cols-2">
        {metrics.map((m) => {
          const scorePercent = m.score !== null ? Math.round(m.score * 100) : null;
          return (
            <div key={m.id} className="rounded-lg border bg-secondary/15 p-2.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-foreground">{m.label}</span>
                  <Badge variant="outline" className="text-[9px] font-mono px-1 py-0 text-muted-foreground">
                    {m.model}
                  </Badge>
                </div>
                <span className="font-mono text-xs font-semibold">
                  {scorePercent !== null ? `${scorePercent}%` : 'n/a'}
                </span>
              </div>

              <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary/75 rounded-full transition-all duration-300"
                  style={{ width: scorePercent !== null ? `${scorePercent}%` : '0%' }}
                />
              </div>

              <p className="text-[10px] text-muted-foreground leading-tight">{m.description}</p>
            </div>
          );
        })}
      </div>

      {/* Mandatory Regulatory / Human-in-the-Loop Footer Note */}
      <div className="flex items-center gap-2 rounded-md bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
        <Info className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span>Scores are algorithmic evidence for review, not proof of identity.</span>
      </div>
    </div>
  );
}
