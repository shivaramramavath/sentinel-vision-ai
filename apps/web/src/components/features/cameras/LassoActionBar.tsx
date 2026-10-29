'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  Maximize2,
  Zap,
  Download,
  X,
  Radio,
  CheckCircle2,
} from 'lucide-react';
import Link from 'next/link';

interface LassoActionBarProps {
  selectedCameraIds: string[];
  onClearSelection: () => void;
  onBulkEnableAi: () => void;
  onBulkAddToWall?: () => void;
  onExportCsv: () => void;
}

export function LassoActionBar({
  selectedCameraIds,
  onClearSelection,
  onBulkEnableAi,
  onBulkAddToWall,
  onExportCsv,
}: LassoActionBarProps) {
  if (selectedCameraIds.length === 0) return null;

  return (
    <div
      data-testid="lasso-action-bar"
      className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-4 py-2.5 rounded-full border border-border bg-background/95 backdrop-blur-md shadow-2xl animate-in fade-in slide-in-from-bottom-4 text-xs select-none"
    >
      <div className="flex items-center gap-1.5 pr-2 border-r border-border font-medium">
        <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
        <span className="font-mono font-bold text-foreground">
          {selectedCameraIds.length}
        </span>
        <span className="text-muted-foreground">
          {selectedCameraIds.length === 1 ? 'camera' : 'cameras'} selected
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <Link href={`/search?cameras=${selectedCameraIds.join(',')}`}>
          <Button size="sm" variant="default" className="h-7 text-xs gap-1.5 px-3">
            <Search className="h-3 w-3" />
            Start AI search
          </Button>
        </Link>

        {onBulkAddToWall && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1.5 px-3"
            onClick={onBulkAddToWall}
          >
            <Maximize2 className="h-3 w-3" />
            Add to live wall
          </Button>
        )}

        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1.5 px-3"
          onClick={onBulkEnableAi}
        >
          <Zap className="h-3 w-3 text-primary" />
          Enable AI
        </Button>

        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1.5 px-3"
          onClick={onExportCsv}
        >
          <Download className="h-3 w-3" />
          Export CSV
        </Button>

        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-muted-foreground hover:text-foreground ml-1"
          onClick={onClearSelection}
          title="Clear selection"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
