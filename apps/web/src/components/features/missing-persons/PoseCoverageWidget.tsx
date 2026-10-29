'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, X, ShieldAlert, Sparkles } from 'lucide-react';
import { ReferenceImageUI } from '@/types/missing-person';

interface PoseCoverageWidgetProps {
  references: ReferenceImageUI[];
  className?: string;
}

const POSE_ANGLES: {
  key: string;
  label: string;
  angle: number; // degrees for circle placement
  shortLabel: string;
}[] = [
  { key: 'front', label: 'Front (0°)', angle: 270, shortLabel: 'F' },
  { key: 'front_right', label: 'Front Right (45°)', angle: 315, shortLabel: 'FR' },
  { key: 'right', label: 'Right Profile (90°)', angle: 0, shortLabel: 'R' },
  { key: 'back_right', label: 'Back Right (135°)', angle: 45, shortLabel: 'BR' },
  { key: 'back', label: 'Back (180°)', angle: 90, shortLabel: 'B' },
  { key: 'back_left', label: 'Back Left (225°)', angle: 135, shortLabel: 'BL' },
  { key: 'left', label: 'Left Profile (270°)', angle: 180, shortLabel: 'L' },
  { key: 'front_left', label: 'Front Left (315°)', angle: 225, shortLabel: 'FL' },
];

export function PoseCoverageWidget({ references, className = '' }: PoseCoverageWidgetProps) {
  // Count references per pose bin
  const coveredBins = new Set<string>();
  let hasBodyFront = false;
  let hasBodyBack = false;
  let hasBodySide = false;

  references.forEach((r) => {
    if (r.status === 'ready' || r.status === 'needs_review') {
      if (r.poseBin) coveredBins.add(r.poseBin);
      if (r.type === 'face_profile_left') coveredBins.add('left');
      if (r.type === 'face_profile_right') coveredBins.add('right');
      if (r.type === 'face_front') coveredBins.add('front');
      if (r.type === 'face_angled') coveredBins.add('front_left');
      if (r.type?.includes('body_full_front') || r.type?.includes('body_upper')) hasBodyFront = true;
      if (r.type?.includes('body_full_back')) hasBodyBack = true;
      if (r.type?.includes('profile') || r.poseBin === 'left' || r.poseBin === 'right') {
        hasBodySide = true;
      }
    }
  });

  const coveredCount = coveredBins.size;
  const coveragePercent = Math.round((coveredCount / 8) * 100);

  return (
    <Card className={`border bg-card text-card-foreground shadow-sm ${className}`}>
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold tracking-wide flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-primary" />
            Pose Coverage (8 Angles)
          </CardTitle>
          <Badge variant={coveragePercent >= 50 ? 'default' : 'secondary'} className="font-mono text-xs">
            {coveredCount}/8 Angles ({coveragePercent}%)
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-2 space-y-4">
        {/* 8-Segment Circular Diagram */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-2">
          <div className="relative w-40 h-40 flex items-center justify-center select-none">
            {/* Center head avatar representation */}
            <div className="w-16 h-16 rounded-full border-2 border-dashed border-muted-foreground/40 flex flex-col items-center justify-center bg-muted/20 text-center z-10 shadow-inner">
              <span className="text-[10px] font-mono text-muted-foreground uppercase font-semibold">Head</span>
              <span className="text-xs font-bold text-foreground">360°</span>
            </div>

            {/* 8 Angular segments positioned radially */}
            {POSE_ANGLES.map(({ key, shortLabel, angle, label }) => {
              const isCovered = coveredBins.has(key);
              // Calculate x, y position on a circle with radius 58px
              const rad = (angle * Math.PI) / 180;
              const radius = 58;
              const x = Math.round(radius * Math.cos(rad));
              const y = Math.round(radius * Math.sin(rad));

              return (
                <div
                  key={key}
                  title={`${label}: ${isCovered ? 'Covered' : 'Missing'}`}
                  style={{
                    transform: `translate(${x}px, ${y}px)`,
                  }}
                  className={`absolute w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold font-mono transition-all duration-200 cursor-help ${
                    isCovered
                      ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-400/40'
                      : 'bg-muted/60 text-muted-foreground/60 border border-dashed border-border hover:border-foreground/40'
                  }`}
                >
                  {shortLabel}
                </div>
              );
            })}
          </div>

          {/* Body Views Checklist */}
          <div className="flex-1 space-y-2.5 text-xs">
            <div className="font-medium text-muted-foreground uppercase tracking-wider text-[11px]">
              Body Views Re-ID Checklist
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between p-2 rounded-md bg-muted/30 border border-border/50">
                <span className="font-medium">Front Full/Upper Body</span>
                {hasBodyFront ? (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1 text-[11px]">
                    <Check className="h-3 w-3" /> Covered
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground gap-1 text-[11px]">
                    <X className="h-3 w-3" /> Missing
                  </Badge>
                )}
              </div>

              <div className="flex items-center justify-between p-2 rounded-md bg-muted/30 border border-border/50">
                <span className="font-medium">Left / Right Side Profile</span>
                {hasBodySide ? (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1 text-[11px]">
                    <Check className="h-3 w-3" /> Covered
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground gap-1 text-[11px]">
                    <X className="h-3 w-3" /> Missing
                  </Badge>
                )}
              </div>

              <div className="flex items-center justify-between p-2 rounded-md bg-muted/30 border border-border/50">
                <span className="font-medium">Back View (Gait & Hair)</span>
                {hasBodyBack ? (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1 text-[11px]">
                    <Check className="h-3 w-3" /> Covered
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground gap-1 text-[11px]">
                    <X className="h-3 w-3" /> Missing
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
