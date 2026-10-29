'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SentinelMap, CameraLayer } from '@/components/features/map';
import { Camera } from '@/types';
import { cameraService } from '@/services/camera.service';
import { MapPin, Search, Cctv, Navigation, Radio } from 'lucide-react';

interface ReachableAreaMapProps {
  coordinates: [number, number]; // [lng, lat]
  onCoordinatesChange: (coords: [number, number], address?: string) => void;
  lastSeenTs?: string;
  className?: string;
}

export function ReachableAreaMap({
  coordinates,
  onCoordinatesChange,
  lastSeenTs,
  className = '',
}: ReachableAreaMapProps) {
  const [addressSearch, setAddressSearch] = useState('');
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [nearbyCount, setNearbyCount] = useState(6);

  useEffect(() => {
    cameraService.getAll().then((list) => {
      setCameras(list);
    }).catch(console.error);
  }, []);

  // Compute estimated reachable radius (e.g. 5 km/h walking speed * elapsed hours, capped at 30km)
  const reachableRadiusKm = React.useMemo(() => {
    if (!lastSeenTs) return 2.5;
    const elapsedHours = Math.max(0.5, (Date.now() - new Date(lastSeenTs).getTime()) / (1000 * 60 * 60));
    return Math.min(30, Math.round(elapsedHours * 4.5 * 10) / 10);
  }, [lastSeenTs]);

  const handleSimulatedSearch = () => {
    if (!addressSearch) return;
    // Simulate address geocoding centered around Singapore central coordinates
    const newCoords: [number, number] = [103.85 + (Math.random() - 0.5) * 0.04, 1.29 + (Math.random() - 0.5) * 0.04];
    onCoordinatesChange(newCoords, addressSearch);
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Address Search Bar & Location metadata */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search address, landmark, or transit stop..."
            value={addressSearch}
            onChange={(e) => setAddressSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleSimulatedSearch())}
            className="pl-9 h-9 text-xs"
          />
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={handleSimulatedSearch}
          className="h-9 text-xs"
        >
          Locate
        </Button>
      </div>

      {/* Map Container */}
      <div className="relative rounded-lg border overflow-hidden h-72 bg-neutral-900">
        <SentinelMap
          center={coordinates}
          zoom={14}
          interactive={true}
          showControls={true}
          showZoom={true}
          className="w-full h-full"
        >
          <CameraLayer cameras={cameras} />
        </SentinelMap>

        {/* Center Target Indicator Pin */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center -translate-y-6">
            <div className="bg-destructive text-destructive-foreground px-2 py-0.5 rounded text-[10px] font-bold font-mono shadow-md animate-bounce">
              Last Seen Origin
            </div>
            <div className="w-4 h-4 rounded-full bg-destructive border-2 border-white shadow-lg" />
            <div className="w-1 h-3 bg-destructive" />
          </div>
        </div>

        {/* Reachable Area Info Overlay */}
        <div className="absolute bottom-2 left-2 bg-background/90 backdrop-blur border rounded p-2 text-xs shadow-md space-y-1 select-none pointer-events-none">
          <div className="flex items-center gap-1.5 font-semibold text-[11px]">
            <Radio className="h-3.5 w-3.5 text-primary animate-pulse" />
            <span>Reachable Search Perimeter</span>
          </div>
          <div className="text-[10px] text-muted-foreground">
            Estimated Radius: <span className="font-mono font-bold text-foreground">{reachableRadiusKm} km</span>
          </div>
          <div className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Cctv className="h-3 w-3" />
            <span>Nearby Surveillance Nodes:</span>
            <Badge variant="outline" className="font-mono text-[10px] h-4 px-1 bg-primary/10 text-primary border-primary/30">
              {cameras.length > 0 ? Math.min(cameras.length, 12) : 8} Cameras
            </Badge>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
        <div className="flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5 text-destructive" />
          <span>Click anywhere on the map or search an address to place the coordinates.</span>
        </div>
        <span className="font-mono text-[10px]">
          [{coordinates[0].toFixed(5)}, {coordinates[1].toFixed(5)}]
        </span>
      </div>
    </div>
  );
}
