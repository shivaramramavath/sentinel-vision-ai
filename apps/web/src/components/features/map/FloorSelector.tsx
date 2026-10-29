'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Building2, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FloorSelectorProps {
  currentFloor: number | 'all';
  onFloorChange: (floor: number | 'all') => void;
  availableFloors?: number[];
  buildingName?: string;
  className?: string;
}

const FLOOR_LABELS: Record<number, string> = {
  [-1]: 'B1',
  [1]: 'L1',
  [2]: 'L2',
  [3]: 'L3',
};

const FLOOR_FULL_NAMES: Record<number, string> = {
  [-1]: 'Basement Concourse',
  [1]: 'Ground Floor Main',
  [2]: 'Mezzanine Departures',
  [3]: 'Upper Observation Deck',
};

/**
 * Indoor Multi-Story Floor Plan Level Selector.
 * Controls floor elevation filtering for multi-level indoor terminals and transit hubs.
 */
export function FloorSelector({
  currentFloor,
  onFloorChange,
  availableFloors = [-1, 1, 2],
  buildingName = 'Central Transit Hub',
  className,
}: FloorSelectorProps) {
  return (
    <div
      className={cn(
        'bg-card/95 backdrop-blur-sm border shadow-md rounded-lg p-1.5 flex flex-col gap-1 z-10',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 px-1.5 py-0.5 border-b pb-1 text-[10px] text-muted-foreground font-mono">
        <span className="flex items-center gap-1 font-semibold text-foreground">
          <Building2 className="h-3 w-3" />
          {buildingName}
        </span>
        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
          {currentFloor === 'all' ? 'All Floors' : FLOOR_FULL_NAMES[currentFloor] ?? `Floor ${currentFloor}`}
        </Badge>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant={currentFloor === 'all' ? 'secondary' : 'ghost'}
          size="sm"
          className="h-6 text-[10px] px-2 font-mono"
          onClick={() => onFloorChange('all')}
        >
          All
        </Button>
        {availableFloors.map((floor) => {
          const isSelected = currentFloor === floor;
          return (
            <Button
              key={floor}
              variant={isSelected ? 'default' : 'ghost'}
              size="sm"
              className={cn(
                'h-6 min-w-7 text-[10px] px-1.5 font-mono font-semibold',
                isSelected && 'shadow-sm',
              )}
              onClick={() => onFloorChange(floor)}
              title={FLOOR_FULL_NAMES[floor]}
            >
              {FLOOR_LABELS[floor] ?? `F${floor}`}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
