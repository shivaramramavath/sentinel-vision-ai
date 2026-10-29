import React from 'react';
import { cn } from '@/lib/utils';

interface ReadinessRingProps {
  score: number; // 0-100
  size?: number; // width/height in px (default 40)
  strokeWidth?: number;
  showText?: boolean;
  className?: string;
  label?: string;
}

export function ReadinessRing({
  score,
  size = 40,
  strokeWidth = 3.5,
  showText = true,
  className,
  label,
}: ReadinessRingProps) {
  const safeScore = Math.max(0, Math.min(100, Math.round(score)));
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (safeScore / 100) * circumference;

  // Blue for >=80, Amber for 50-79, Muted for <50
  const strokeColor =
    safeScore >= 80 ? 'stroke-blue-500' : safeScore >= 50 ? 'stroke-amber-500' : 'stroke-muted-foreground/60';

  return (
    <div
      className={cn('inline-flex items-center gap-2 select-none', className)}
      title={label || `Search Readiness Index: ${safeScore}/100`}
    >
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg className="h-full w-full -rotate-90" viewBox={`0 0 ${size} ${size}`}>
          {/* Background Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            className="stroke-muted/30"
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* Progress Indicator */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            className={cn('transition-all duration-500 ease-out', strokeColor)}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="none"
          />
        </svg>
        {showText && (
          <span className="absolute font-mono text-[10px] font-bold text-foreground">
            {safeScore}
          </span>
        )}
      </div>
      {label && (
        <div className="flex flex-col">
          <span className="text-xs font-semibold">{safeScore}%</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
        </div>
      )}
    </div>
  );
}
