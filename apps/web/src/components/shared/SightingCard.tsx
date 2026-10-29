'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { StatusChip } from './StatusChip';
import { cn } from '@/lib/utils';
import { Sighting } from '@/types';
import { Camera, Clock, MapPin } from 'lucide-react';

interface SightingCardProps {
  sighting: Sighting;
  isSelected?: boolean;
  isChecked?: boolean;
  onCheckChange?: (checked: boolean) => void;
  onClick?: () => void;
  isNew?: boolean;
  className?: string;
  compact?: boolean;
}

export function SightingCard({
  sighting,
  isSelected,
  isChecked,
  onCheckChange,
  onClick,
  isNew,
  className,
  compact = false,
}: SightingCardProps) {
  const fusedPercent = Math.round(sighting.fusedRank * 100);

  return (
    <Card
      onClick={onClick}
      className={cn(
        'group relative overflow-hidden rounded-lg border transition-all cursor-pointer hover:border-primary/50 hover:shadow-sm',
        isSelected ? 'border-primary ring-2 ring-primary/20 bg-secondary/20' : 'bg-card',
        className,
      )}
    >
      {/* "New" Unreviewed Indicator Dot */}
      {isNew && sighting.status === 'pending_review' && (
        <span
          className="absolute top-2 right-2 z-10 h-2 w-2 rounded-full bg-amber-500 animate-pulse"
          title="New Candidate"
        />
      )}

      <div className={cn('flex items-center gap-3', compact ? 'p-2' : 'p-3')}>
        {/* Optional Multi-Select Checkbox */}
        {onCheckChange && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex items-center justify-center shrink-0"
          >
            <Checkbox
              checked={isChecked}
              onCheckedChange={(val) => onCheckChange(Boolean(val))}
              aria-label={`Select sighting ${sighting.id}`}
            />
          </div>
        )}

        {/* Thumbnail Crop */}
        <div className="relative aspect-square w-14 h-14 rounded-md overflow-hidden bg-muted shrink-0 border">
          <img
            src={sighting.candidateFrameUrl}
            alt={sighting.personName}
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <div className="absolute bottom-0 inset-x-0 bg-background/80 py-0.5 text-center">
            <span className="font-mono text-[9px] font-bold text-foreground">
              {fusedPercent}%
            </span>
          </div>
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-semibold text-foreground truncate">
              {sighting.personName}
            </span>
            <StatusChip status={sighting.status} size="sm" />
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground truncate">
            <Camera className="h-3 w-3 shrink-0" />
            <span className="truncate">{sighting.cameraName}</span>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/80 font-mono">
            <Clock className="h-2.5 w-2.5 shrink-0" />
            <span>{new Date(sighting.detectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
