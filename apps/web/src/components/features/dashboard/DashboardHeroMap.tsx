'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Camera, Case, Journey, CameraTopologyTransition, SystemAlert } from '@/types';
import { SentinelMap, CameraLayer } from '@/components/features/map';
import { RealtimeTrackLayer } from '@/components/features/map/RealtimeTrackLayer';
import { LastKnownLayer } from '@/components/features/map/LastKnownLayer';
import { JourneyLayer } from '@/components/features/map/JourneyLayer';
import { TopologyLayer } from '@/components/features/map/TopologyLayer';
import { MapLegend } from '@/components/features/map/MapLegend';
import { getCameraCoords } from '@/components/features/map/CameraMarker';
import { DashboardKpiStrip } from './DashboardKpiStrip';
import { useUiStore } from '@/stores/ui.store';
import { useRealtimeMapSocket } from '@/hooks/useRealtimeMapSocket';
import { useMap } from '@/components/ui/map';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu';

import {
  SlidersHorizontal,
  Crosshair,
  Minimize2,
  Maximize2,
  ExternalLink,
  Video,
  Eye,
  AlertTriangle,
  X,
  Radio,
  Users,
  Compass,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TrackUpdatedEvent } from '@sentinel/shared-types';

export interface DashboardHeroMapProps {
  cameras?: Camera[];
  cases?: Case[];
  journeys?: Journey[];
  alerts?: SystemAlert[];
  transitions?: any[];
  selectedCaseId?: string;
  onSelectCaseId?: (caseId: string) => void;
  onOpenLiveCamera?: (camera: Camera) => void;
  targetFocusCameraId?: string | null;
  targetFocusAlert?: SystemAlert | null;
  onClearTargetFocus?: () => void;
  className?: string;
}

/**
 * Internal Map Controller hook that connects directly to the MapLibre instance
 * to smoothly execute flyTo, fitBounds, and coordinate calculations.
 */
function MapController({
  targetCoords,
  fitBoundsTrigger,
  fitCoordinates,
}: {
  targetCoords: [number, number] | null;
  fitBoundsTrigger: number;
  fitCoordinates: [number, number][];
}) {
  const { map, isLoaded } = useMap();

  // Fly to single target coordinate
  useEffect(() => {
    if (!isLoaded || !map || !targetCoords) return;
    map.flyTo({
      center: targetCoords,
      zoom: 16.2,
      essential: true,
      duration: 1200,
    });
  }, [map, isLoaded, targetCoords]);

  // Fit bounds to multiple coordinates (e.g. alerts)
  useEffect(() => {
    if (!isLoaded || !map || fitBoundsTrigger === 0 || fitCoordinates.length === 0) return;

    let minLng = fitCoordinates[0][0];
    let maxLng = fitCoordinates[0][0];
    let minLat = fitCoordinates[0][1];
    let maxLat = fitCoordinates[0][1];

    for (const [lng, lat] of fitCoordinates) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }

    // Add tiny margin if single point
    if (minLng === maxLng && minLat === maxLat) {
      map.flyTo({
        center: [minLng, minLat],
        zoom: 16,
        duration: 1000,
      });
      return;
    }

    map.fitBounds(
      [
        [minLng, minLat],
        [maxLng, maxLat],
      ],
      {
        padding: 70,
        maxZoom: 16,
        duration: 1200,
      },
    );
  }, [map, isLoaded, fitBoundsTrigger, fitCoordinates]);

  return null;
}

export function DashboardHeroMap({
  cameras = [],
  cases = [],
  journeys = [],
  alerts = [],
  transitions = [],
  selectedCaseId: controlledCaseId,
  onSelectCaseId,
  onOpenLiveCamera,
  targetFocusCameraId,
  targetFocusAlert,
  onClearTargetFocus,
  className,
}: DashboardHeroMapProps) {
  const { dashboardMapCollapsed, toggleDashboardMapCollapsed } = useUiStore();

  // Internal state for filters and layers
  const [activeCaseId, setActiveCaseId] = useState<string>(controlledCaseId || cases[0]?.id || 'case_001');
  const [selectedSite, setSelectedSite] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'live' | 'degraded' | 'offline'>('all');
  
  // Layer toggles
  const [enableClustering, setEnableClustering] = useState<boolean>(true);
  const [showTopology, setShowTopology] = useState<boolean>(false);
  const [showTracks, setShowTracks] = useState<boolean>(true);
  const [showJourney, setShowJourney] = useState<boolean>(true);
  const [showReachableArea, setShowReachableArea] = useState<boolean>(true);

  // Selected item card state (camera or alert)
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);
  const [focusedAlert, setFocusedAlert] = useState<SystemAlert | null>(null);

  // Map flyTo controller state
  const [mapTargetCoords, setMapTargetCoords] = useState<[number, number] | null>(null);
  const [fitBoundsTrigger, setFitBoundsTrigger] = useState<number>(0);

  // Keep internal case state synced with prop
  useEffect(() => {
    if (controlledCaseId) {
      setActiveCaseId(controlledCaseId);
    }
  }, [controlledCaseId]);

  // Handle external alert focus from Recent Alerts row
  useEffect(() => {
    if (targetFocusAlert) {
      setFocusedAlert(targetFocusAlert);
      // Attempt to resolve camera for alert
      const camMatch = targetFocusAlert.message.match(/CAM-(\d+)/i) || targetFocusAlert.title.match(/CAM-(\d+)/i);
      let foundCam: Camera | undefined;
      if (camMatch) {
        const num = parseInt(camMatch[1], 10);
        const camId = num <= 6 ? `cam_${String(num).padStart(2, '0')}` : `cam_${String(num).padStart(3, '0')}`;
        foundCam = cameras.find((c) => c.id.toLowerCase() === camId.toLowerCase());
      }
      if (!foundCam && targetFocusAlert.sightingId) {
        // match from journey
        for (const j of journeys) {
          const step = j.cameraSequence.find((s) => s.sightingId === targetFocusAlert.sightingId);
          if (step) {
            foundCam = cameras.find((c) => c.id === step.cameraId);
            break;
          }
        }
      }
      if (foundCam) {
        setSelectedCamera(foundCam);
        setMapTargetCoords(getCameraCoords(foundCam));
      }
    }
  }, [targetFocusAlert, cameras, journeys]);

  // Handle target camera focus
  useEffect(() => {
    if (targetFocusCameraId) {
      const cam = cameras.find((c) => c.id === targetFocusCameraId);
      if (cam) {
        setSelectedCamera(cam);
        setFocusedAlert(null);
        setMapTargetCoords(getCameraCoords(cam));
      }
    }
  }, [targetFocusCameraId, cameras]);

  // Real-time WebSocket hook for in-place feature updates
  const { activeTracksMap } = useRealtimeMapSocket({
    caseId: activeCaseId,
  });

  // Current selected case & journey
  const currentCase = useMemo(() => {
    return cases.find((c) => c.id === activeCaseId) || cases[0];
  }, [cases, activeCaseId]);

  const currentJourney = useMemo(() => {
    return journeys.find((j) => j.caseId === activeCaseId) || journeys[0];
  }, [journeys, activeCaseId]);

  // Filtered cameras based on site and status
  const filteredCameras = useMemo(() => {
    return cameras.filter((cam) => {
      if (selectedStatus !== 'all' && cam.status !== selectedStatus) {
        return false;
      }
      if (selectedSite !== 'all') {
        const camZone = cam.zone?.toLowerCase() || '';
        const camName = cam.name.toLowerCase();
        const siteLower = selectedSite.toLowerCase();
        if (!camZone.includes(siteLower) && !camName.includes(siteLower)) {
          return false;
        }
      }
      return true;
    });
  }, [cameras, selectedStatus, selectedSite]);

  // Coordinates for "Fit to alerts"
  const alertCamerasCoordinates = useMemo<[number, number][]>(() => {
    const coords: [number, number][] = [];
    // Cameras with active alerts or detections
    cameras.forEach((cam) => {
      const hasAlert = alerts.some((a) => a.message.includes(cam.name.split(':')[0]) || a.title.includes(cam.name.split(':')[0]));
      const hasDetections = (cam.activeDetections ?? 0) > 0;
      if (hasAlert || hasDetections) {
        coords.push(getCameraCoords(cam));
      }
    });
    // Fallback to all cameras if none with alerts
    if (coords.length === 0 && cameras.length > 0) {
      coords.push(getCameraCoords(cameras[0]));
    }
    return coords;
  }, [cameras, alerts]);

  // Default initial center from first camera or last seen
  const initialCenter = useMemo<[number, number]>(() => {
    if (currentJourney && currentJourney.cameraSequence.length > 0) {
      const first = currentJourney.cameraSequence[0];
      return [first.coords[1], first.coords[0]];
    }
    if (cameras.length > 0) {
      return getCameraCoords(cameras[0]);
    }
    return [-74.006, 40.7128];
  }, [currentJourney, cameras]);

  // Last known coordinate for selected case
  const lastKnownCenter = useMemo<[number, number]>(() => {
    if (currentJourney && currentJourney.cameraSequence.length > 0) {
      const last = currentJourney.cameraSequence[currentJourney.cameraSequence.length - 1];
      return [last.coords[1], last.coords[0]];
    }
    return [-74.006, 40.7128];
  }, [currentJourney]);

  // Generate synthetic / live tracks for ByteTrack
  const activeTracksList = useMemo<TrackUpdatedEvent[]>(() => {
    const socketTracks = Object.values(activeTracksMap);
    if (socketTracks.length > 0) return socketTracks;

    // Default simulated tracks around active cameras
    return cameras
      .filter((c) => (c.activeDetections ?? 0) > 0)
      .slice(0, 8)
      .map((cam, idx) => {
        const [lng, lat] = getCameraCoords(cam);
        return {
          trackId: 100 + idx,
          cameraId: cam.id,
          caseId: activeCaseId,
          ts: new Date().toISOString(),
          bbox: [120, 90, 70, 160] as [number, number, number, number],
          coordinates: [lng + 0.0001 * (idx % 2 === 0 ? 1 : -1), lat + 0.00008 * (idx % 3 === 0 ? 1 : -1)],
          confidence: 0.92,
        };
      });
  }, [activeTracksMap, cameras, activeCaseId]);

  const handleCaseChange = useCallback(
    (caseId: string) => {
      setActiveCaseId(caseId);
      onSelectCaseId?.(caseId);
      // Center map on case starting node
      const j = journeys.find((item) => item.caseId === caseId);
      if (j && j.cameraSequence.length > 0) {
        setMapTargetCoords([j.cameraSequence[0].coords[1], j.cameraSequence[0].coords[0]]);
      }
    },
    [journeys, onSelectCaseId],
  );

  const handleCameraClick = useCallback((cam: Camera) => {
    setSelectedCamera(cam);
    setFocusedAlert(null);
  }, []);

  const handleFitAlerts = useCallback(() => {
    setFitBoundsTrigger((prev) => prev + 1);
  }, []);

  return (
    <div
      className={cn(
        'relative w-full rounded-xl border border-border bg-card overflow-hidden shadow-sm transition-all duration-300',
        dashboardMapCollapsed ? 'h-[200px]' : 'h-[clamp(420px,55vh,640px)]',
        className,
      )}
    >
      {/* SentinelMap container */}
      <SentinelMap
        center={initialCenter}
        zoom={14.8}
        controlsPosition="bottom-right"
        showFullscreen={false}
        showLocate={false}
        className="h-full w-full"
      >
        {/* Map Controller for flyTo and fitBounds */}
        <MapController
          targetCoords={mapTargetCoords}
          fitBoundsTrigger={fitBoundsTrigger}
          fitCoordinates={alertCamerasCoordinates}
        />

        {/* Camera Layer with 2s live preview snapshot tooltips & clustering */}
        <CameraLayer
          cameras={filteredCameras}
          enableClustering={enableClustering}
          clusteringThreshold={60}
          showTooltip={true}
          selectedCameraId={selectedCamera?.id}
          onSelectCamera={handleCameraClick}
        />

        {/* Realtime ByteTrack tracks (pulsing blue dots) */}
        {showTracks && <RealtimeTrackLayer tracks={activeTracksList} />}

        {/* Last Known Layer + reachable area circle for selected case */}
        {showReachableArea && currentCase && (
          <LastKnownLayer
            center={lastKnownCenter}
            lastSeenTimestamp={currentCase.lastSeenAt}
            locationName={currentCase.lastSeenLocation}
            walkingSpeedMps={1.4}
            maxRadiusMeters={800}
            cameras={cameras}
            onSuggestedCameraClick={handleCameraClick}
          />
        )}

        {/* Journey Layer for selected case */}
        {showJourney && currentJourney && (
          <JourneyLayer
            journey={currentJourney}
            showPopups={true}
          />
        )}

        {/* Camera Topology Layer */}
        {showTopology && (
          <TopologyLayer
            cameras={cameras}
            transitions={transitions}
            mode="lines"
            color="#8b5cf6"
            width={2}
            opacity={0.65}
          />
        )}
      </SentinelMap>

      {/* ================= MAP OVERLAYS (Glass Effect) ================= */}

      {/* Top-Left: KPI Strip (Desktop/Tablet overlay; Mobile renders above map) */}
      <div className="absolute top-3 left-3 z-10 hidden md:block pointer-events-auto">
        <DashboardKpiStrip isOverlay={true} />
      </div>

      {/* Top-Right: Filter Popover, Fit to Alerts, Collapse Map, Full Map */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 pointer-events-auto">
        {/* Filter Popover Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 bg-background/85 backdrop-blur-md border-border/80 text-xs shadow-xs hover:bg-background/95"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Filters</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-background/95 backdrop-blur-md">
            <DropdownMenuLabel className="text-[11px] font-mono uppercase text-muted-foreground">
              Surveillance Case
            </DropdownMenuLabel>
            {cases.map((c) => (
              <DropdownMenuCheckboxItem
                key={c.id}
                checked={activeCaseId === c.id}
                onCheckedChange={() => handleCaseChange(c.id)}
                className="text-xs"
              >
                {c.personName}
              </DropdownMenuCheckboxItem>
            ))}

            <DropdownMenuSeparator />

            <DropdownMenuLabel className="text-[11px] font-mono uppercase text-muted-foreground">
              Camera Status
            </DropdownMenuLabel>
            {(['all', 'live', 'degraded', 'offline'] as const).map((st) => (
              <DropdownMenuCheckboxItem
                key={st}
                checked={selectedStatus === st}
                onCheckedChange={() => setSelectedStatus(st)}
                className="text-xs capitalize"
              >
                {st === 'all' ? 'All Statuses' : st}
              </DropdownMenuCheckboxItem>
            ))}

            <DropdownMenuSeparator />

            <DropdownMenuLabel className="text-[11px] font-mono uppercase text-muted-foreground">
              Layer Overlays
            </DropdownMenuLabel>
            <DropdownMenuCheckboxItem
              checked={enableClustering}
              onCheckedChange={setEnableClustering}
              className="text-xs"
            >
              Camera Clustering (60+)
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={showTracks}
              onCheckedChange={setShowTracks}
              className="text-xs"
            >
              ByteTrack Live Tracks
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={showJourney}
              onCheckedChange={setShowJourney}
              className="text-xs"
            >
              Case Journey Trajectory
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={showReachableArea}
              onCheckedChange={setShowReachableArea}
              className="text-xs"
            >
              Reachable Area Dispersion
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={showTopology}
              onCheckedChange={setShowTopology}
              className="text-xs"
            >
              Camera Topology Graph
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Fit to alerts button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleFitAlerts}
          title="Fit map view to active alerts and tracks"
          className="h-8 gap-1.5 bg-background/85 backdrop-blur-md border-border/80 text-xs shadow-xs hover:bg-background/95"
        >
          <Crosshair className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Fit to alerts</span>
        </Button>

        {/* Collapse map toggle */}
        <Button
          variant="outline"
          size="icon"
          onClick={toggleDashboardMapCollapsed}
          title={dashboardMapCollapsed ? 'Expand map' : 'Collapse map'}
          className="h-8 w-8 bg-background/85 backdrop-blur-md border-border/80 shadow-xs hover:bg-background/95"
        >
          {dashboardMapCollapsed ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
        </Button>

        {/* Full Map & Topology link */}
        <Link href="/locations">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 bg-background/85 backdrop-blur-md border-border/80 text-xs shadow-xs hover:bg-background/95"
          >
            <span className="hidden sm:inline">Full Map & Topology</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>

      {/* Bottom-Right: Map Legend */}
      <div className="absolute bottom-3 right-3 z-10 max-w-[280px] pointer-events-auto">
        <MapLegend
          defaultExpanded={false}
          showJourneyItems={showJourney}
          showDispersionItems={showReachableArea}
        />
      </div>

      {/* Bottom-Left: Selected Item Card (on marker or alert click) */}
      {(selectedCamera || focusedAlert) && (
        <div className="absolute bottom-3 left-3 z-10 max-w-sm pointer-events-auto animate-in fade-in slide-in-from-bottom-2 duration-200">
          <Card className="bg-background/90 backdrop-blur-md border border-border/80 shadow-lg p-3 text-xs">
            <div className="flex items-start justify-between gap-2 border-b pb-2 mb-2">
              <div className="flex items-center gap-1.5 font-semibold text-foreground">
                {focusedAlert ? (
                  <>
                    <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                    <span className="truncate max-w-[220px]">{focusedAlert.title}</span>
                  </>
                ) : (
                  <>
                    <Video className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate max-w-[220px]">{selectedCamera?.name}</span>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedCamera(null);
                  setFocusedAlert(null);
                  onClearTargetFocus?.();
                }}
                className="text-muted-foreground hover:text-foreground rounded p-0.5"
                title="Close"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {focusedAlert ? (
              <div className="space-y-2">
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {focusedAlert.message}
                </p>
                <div className="flex items-center justify-between gap-2 pt-1 font-mono text-[10px]">
                  <span className="text-muted-foreground">{focusedAlert.timestamp}</span>
                  <Link href={`/sightings${focusedAlert.caseId ? `?caseId=${focusedAlert.caseId}` : ''}`}>
                    <Button variant="default" size="sm" className="h-6 text-[10px] px-2 gap-1 font-mono">
                      <Eye className="h-3 w-3" /> Inspect evidence
                    </Button>
                  </Link>
                </div>
              </div>
            ) : selectedCamera ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <span>ID:</span>
                    <span className="text-foreground">{selectedCamera.id}</span>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <span>STATUS:</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[9px] uppercase px-1 py-0 h-4',
                        selectedCamera.status === 'live'
                          ? 'border-emerald-500 text-emerald-500'
                          : selectedCamera.status === 'degraded'
                          ? 'border-amber-500 text-amber-500'
                          : 'border-rose-500 text-rose-500',
                      )}
                    >
                      {selectedCamera.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <span>FPS:</span>
                    <span className="text-foreground font-semibold">30 FPS</span>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <span>TRACKS:</span>
                    <span className="text-foreground font-semibold">
                      {selectedCamera.activeDetections ?? 0} active
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => onOpenLiveCamera?.(selectedCamera)}
                    className="h-6 text-[10px] px-2 gap-1 font-mono flex-1"
                  >
                    <Video className="h-3 w-3" /> Open live
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Fly to camera coordinates
                      setMapTargetCoords(getCameraCoords(selectedCamera));
                    }}
                    className="h-6 text-[10px] px-2 gap-1 font-mono flex-1"
                  >
                    <Crosshair className="h-3 w-3" /> Track
                  </Button>
                </div>
              </div>
            ) : null}
          </Card>
        </div>
      )}
    </div>
  );
}
