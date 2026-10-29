'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Sparkles, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { ReadinessScoreResult } from '@/types/missing-person';

interface ReadinessGaugeProps {
  readiness?: ReadinessScoreResult;
  className?: string;
}

export function ReadinessGauge({ readiness, className = '' }: ReadinessGaugeProps) {
  const score = readiness?.score ?? 0;
  const breakdown = readiness?.breakdown ?? {
    faceQuality: 0,
    poseDiversity: 0,
    bodyFullness: 0,
    temporalRecency: 0,
  };
  const recommendations = readiness?.recommendations ?? [];

  // Determine color scheme
  let colorClass = 'text-emerald-500';
  let badgeVariant: 'default' | 'secondary' | 'destructive' = 'default';
  let tierLabel = 'SEARCH READY';

  if (score < 50) {
    colorClass = 'text-rose-500';
    badgeVariant = 'destructive';
    tierLabel = 'INSUFFICIENT';
  } else if (score < 80) {
    colorClass = 'text-amber-500';
    badgeVariant = 'secondary';
    tierLabel = 'SUBOPTIMAL';
  }

  // Calculate SVG circular stroke
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <Card className={`border bg-card text-card-foreground shadow-sm ${className}`}>
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold tracking-wide flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-primary" />
            Biometric Search Readiness
          </CardTitle>
          <Badge variant={badgeVariant} className="font-mono text-xs font-semibold tracking-wider">
            {tierLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-2 space-y-4">
        <div className="flex items-center gap-6">
          {/* Radial Circular Meter */}
          <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              {/* Background ring */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                className="stroke-muted"
                strokeWidth="10"
                fill="transparent"
              />
              {/* Progress ring */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                className={`transition-all duration-700 ease-out ${colorClass}`}
                strokeWidth="10"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
                stroke="currentColor"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-2xl font-black font-mono tracking-tight text-foreground">{score}%</span>
              <span className="text-[10px] text-muted-foreground uppercase font-semibold">Readiness</span>
            </div>
          </div>

          {/* Breakdown progress metrics */}
          <div className="flex-1 space-y-2 text-xs">
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-muted-foreground">Face Resolution & Sharpness</span>
                <span className="font-mono font-bold">{breakdown.faceQuality}%</span>
              </div>
              <Progress value={breakdown.faceQuality} className="h-1.5" />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-muted-foreground">Pose Angle Coverage (8 Bins)</span>
                <span className="font-mono font-bold">{breakdown.poseDiversity}%</span>
              </div>
              <Progress value={breakdown.poseDiversity} className="h-1.5" />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-muted-foreground">Full Body Re-ID Views</span>
                <span className="font-mono font-bold">{breakdown.bodyFullness}%</span>
              </div>
              <Progress value={breakdown.bodyFullness} className="h-1.5" />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-muted-foreground">Temporal Recency</span>
                <span className="font-mono font-bold">{breakdown.temporalRecency}%</span>
              </div>
              <Progress value={breakdown.temporalRecency} className="h-1.5" />
            </div>
          </div>
        </div>

        {/* Recommendations / How to Improve */}
        {recommendations.length > 0 && (
          <div className="rounded-md border border-border/60 bg-muted/20 p-3 space-y-1.5 text-xs">
            <div className="font-semibold text-foreground flex items-center gap-1.5 text-[11px]">
              <Info className="h-3.5 w-3.5 text-primary" />
              How to improve search accuracy:
            </div>
            <ul className="space-y-1 pl-4 list-disc text-muted-foreground">
              {recommendations.map((rec, i) => (
                <li key={i}>{rec}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
