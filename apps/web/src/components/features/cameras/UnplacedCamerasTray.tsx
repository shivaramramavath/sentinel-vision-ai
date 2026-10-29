'use client';

import React, { useState } from 'react';
import { Camera } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  MapPin,
  ChevronUp,
  ChevronDown,
  Navigation,
  Compass,
  Move,
  X,
  Smartphone,
  Video,
} from 'lucide-react';
import { useCameras } from '@/hooks/use-cameras';
import { getUnplacedCameras } from '@/lib/selectors/camera-selectors';
import { cn } from '@/lib/utils';

interface UnplacedCamerasTrayProps {
  onStartPlacingCamera: (camera: Camera) => void;
  placingCameraId?: string | null;
}

export function UnplacedCamerasTray({
  onStartPlacingCamera,
  placingCameraId,
}: UnplacedCamerasTrayProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { data: cameras = [] } = useCameras();
  const unplacedCameras = React.useMemo(() => getUnplacedCameras(cameras), [cameras]);

  if (unplacedCameras.length === 0) return null;

  return (
    <div className="absolute bottom-4 left-4 z-30 select-none">
      {/* Collapsed Chip Trigger */}
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-background/95 backdrop-blur shadow-lg cursor-pointer transition-all hover:border-foreground/60 text-xs',
          isOpen && 'rounded-b-none border-b-0',
          placingCameraId && 'ring-2 ring-primary animate-pulse',
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
        <span className="font-semibold text-foreground">
          {unplacedCameras.length} Unplaced {unplacedCameras.length === 1 ? 'Camera' : 'Cameras'}
        </span>
        <Badge variant="outline" className="text-[10px] font-mono h-4 px-1 border-amber-500/40 text-amber-500">
          Needs GPS
        </Badge>
        {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />}
      </div>

      {/* Expanded Tray Drawer */}
      {isOpen && (
        <div className="w-80 max-h-72 overflow-y-auto rounded-b-xl border border-border bg-background/95 backdrop-blur p-3 shadow-2xl space-y-2 animate-in fade-in slide-in-from-bottom-2 text-xs">
          <p className="text-[11px] text-muted-foreground leading-tight">
            Click <span className="font-semibold text-foreground">Place</span> then click on the map to set physical coordinates, heading, and coverage cone.
          </p>

          <div className="space-y-1.5">
            {unplacedCameras.map((cam) => {
              const isSelectedForPlacement = placingCameraId === cam.id;
              const isMobile = cam.sourceType === 'mobile_webrtc' || cam.sourceType === 'mobile_rtmp';

              return (
                <div
                  key={cam.id}
                  className={cn(
                    'p-2.5 rounded-lg border border-border bg-card flex items-center justify-between gap-2 transition-colors',
                    isSelectedForPlacement && 'border-primary bg-primary/5',
                  )}
                >
                  <div className="space-y-0.5 truncate">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-foreground">
                        {cam.cameraCode || cam.id}
                      </span>
                      {isMobile ? (
                        <Smartphone className="h-3 w-3 text-blue-500" />
                      ) : (
                        <Video className="h-3 w-3 text-muted-foreground" />
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground block truncate">
                      {cam.name}
                    </span>
                  </div>

                  <Button
                    size="sm"
                    variant={isSelectedForPlacement ? 'default' : 'outline'}
                    className="h-7 text-[11px] gap-1 px-2.5 shrink-0"
                    onClick={() => onStartPlacingCamera(cam)}
                  >
                    <MapPin className="h-3 w-3" />
                    {isSelectedForPlacement ? 'Placing...' : 'Place'}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
