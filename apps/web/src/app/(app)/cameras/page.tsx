'use client';

import React, { useState, useMemo, useEffect, useCallback, Suspense, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Camera, CameraTopologyTransition, Case } from '@/types';
import {
  filterCameras as selectCameras,
  findCameraById as selectCameraById,
  getUnplacedCameras as selectUnplacedCameras,
  getSitesFromCameras as selectSites,
} from '@/lib/selectors/camera-selectors';
import { useCameras, useCameraTopology, useUpdateCamera } from '@/hooks/use-cameras';
import { useCases } from '@/hooks/use-cases';
import {
  SentinelMap,
  CameraLayer,
  CameraFovLayer,
  TopologyLayer,
  DetectionHeatmapLayer,
  FloorSelector,
  RealtimeTrackLayer,
  LastKnownLayer,
  getCameraCoords,
} from '@/components/features/map';
import { CameraPlayer } from '@/components/features/cameras/CameraPlayer';
import { AddCameraWizard } from '@/components/features/cameras/AddCameraWizard';
import { CameraDetailPanel } from '@/components/features/cameras/CameraDetailPanel';
import { BandwidthHealthSheet } from '@/components/features/cameras/BandwidthHealthSheet';
import { TopologyEditBanner } from '@/components/features/cameras/TopologyEditBanner';
import { UnplacedCamerasTray } from '@/components/features/cameras/UnplacedCamerasTray';
import { LassoActionBar } from '@/components/features/cameras/LassoActionBar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Search,
  Plus,
  LayoutGrid,
  List,
  Columns2,
  Map as MapIcon,
  Maximize2,
  Minimize2,
  Layers,
  Network,
  Activity,
  Zap,
  SlidersHorizontal,
  Flame,
  Radio,
  Eye,
  Video,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  WifiOff,
  MoreVertical,
  Play,
  RotateCw,
  FolderOpen,
  X,
  Compass,
  ArrowUpDown,
  Sliders,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

type ViewMode = 'split' | 'grid' | 'table' | 'map' | 'wall';
type WallLayout = '1x1' | '2x2' | '3x3' | '4x4' | 'focus';

function CamerasPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL state synchronization
  const viewParam = (searchParams.get('view') as ViewMode) || 'split';
  const cameraParam = searchParams.get('camera') || null;
  const siteParam = searchParams.get('site') || 'all';
  const floorParam = searchParams.get('floor') || 'all';
  const statusParam = searchParams.get('status') || 'all';
  const typeParam = searchParams.get('type') || 'all';
  const modeParam = searchParams.get('mode') || 'view';
  const queryParam = searchParams.get('q') || '';

  // React Query Hooks
  const { data: rawCameras = [] } = useCameras();
  const { data: topologyTransitions = [] } = useCameraTopology();
  const { data: cases = [] } = useCases();
  const updateCameraMutation = useUpdateCamera();
  const updateCamera = (id: string, dto: Partial<Camera>) => updateCameraMutation.mutate({ id, dto });
  const placeCameraInStore = (id: string, coords: [number, number], fov?: number, heading?: number) =>
    updateCameraMutation.mutate({ id, dto: { coords, latitude: coords[0], longitude: coords[1], fovDegrees: fov, heading } });
  const bulkUpdateAiPolicy = (ids: string[], enabled: boolean) =>
    ids.forEach((id) => updateCameraMutation.mutate({ id, dto: { aiPolicy: { enabled } as any } }));

  // Derived counts and collections via useMemo
  const totalCount = rawCameras.length;
  const liveCount = useMemo(() => rawCameras.filter((c) => c.status === 'live').length, [rawCameras]);
  const degradedCount = useMemo(() => rawCameras.filter((c) => c.status === 'degraded').length, [rawCameras]);
  const offlineCount = useMemo(() => rawCameras.filter((c) => c.status === 'offline').length, [rawCameras]);
  const availableSites = useMemo(() => selectSites(rawCameras), [rawCameras]);

  // UI state
  const [view, setView] = useState<ViewMode>(viewParam);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(cameraParam);
  const [hoveredCameraId, setHoveredCameraId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState(queryParam);
  const [siteFilter, setSiteFilter] = useState(siteParam);
  const [floorFilter, setFloorFilter] = useState<number | 'all'>(
    floorParam === 'all' ? 'all' : parseInt(floorParam, 10),
  );
  const [statusFilter, setStatusFilter] = useState<'all' | 'live' | 'degraded' | 'offline'>(
    (statusParam as any) || 'all',
  );
  const [sourceTypeFilter, setSourceTypeFilter] = useState(typeParam);

  // Quick Filters
  const [aiFilterOnly, setAiFilterOnly] = useState(false);
  const [recordingFilterOnly, setRecordingFilterOnly] = useState(false);
  const [mobileFilterOnly, setMobileFilterOnly] = useState(false);

  // Layers Toggles
  const [showFov, setShowFov] = useState(true);
  const [showTopology, setShowTopology] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showClusters, setShowClusters] = useState(true);
  const [showActiveTracks, setShowActiveTracks] = useState(true);
  const [showCaseOverlay, setShowCaseOverlay] = useState(false);
  const [activeCaseId, setActiveCaseId] = useState<string>('case_001');

  // Topology Edit Mode
  const [isTopologyMode, setIsTopologyMode] = useState(modeParam === 'topology');
  const [edgeStartCam, setEdgeStartCam] = useState<Camera | null>(null);
  const [edgeEndCam, setEdgeEndCam] = useState<Camera | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<CameraTopologyTransition | null>(null);

  // Unplaced Camera Placement Mode
  const [placingCamera, setPlacingCamera] = useState<Camera | null>(null);

  // Modals & Sheets
  const [isAddWizardOpen, setIsAddWizardOpen] = useState(false);
  const [isBandwidthSheetOpen, setIsBandwidthSheetOpen] = useState(false);

  // Multi-Selection for Bulk Actions
  const [selectedCameraIds, setSelectedCameraIds] = useState<string[]>([]);

  // Live Wall State
  const [wallLayout, setWallLayout] = useState<WallLayout>('2x2');
  const [wallAutoRotate, setWallAutoRotate] = useState(false);
  const [wallPageIndex, setWallPageIndex] = useState(0);

  // Sync state with URL params
  const updateUrlParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === null || value === '' || value === 'all') {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      router.replace(`/cameras?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const handleSelectCamera = useCallback(
    (cam: Camera | null) => {
      const id = cam ? cam.cameraCode || cam.id : null;
      setSelectedCameraId(id);
      updateUrlParam('camera', id);
    },
    [updateUrlParam],
  );

  const handleViewChange = useCallback(
    (newView: ViewMode) => {
      setView(newView);
      updateUrlParam('view', newView);
    },
    [updateUrlParam],
  );

  const handleEnterTopologyMode = () => {
    setIsTopologyMode(true);
    updateUrlParam('mode', 'topology');
    if (view === 'grid' || view === 'table') {
      handleViewChange('split');
    }
  };

  const handleExitTopologyMode = () => {
    setIsTopologyMode(false);
    setEdgeStartCam(null);
    setEdgeEndCam(null);
    setSelectedEdge(null);
    updateUrlParam('mode', null);
  };

  // Filtered cameras computed via selector
  const filteredCameras = useMemo(() => {
    return selectCameras(
      rawCameras,
      {
        status: statusFilter,
        siteId: siteFilter,
        floor: floorFilter,
        sourceType: sourceTypeFilter,
        q: searchQuery,
        aiOnly: aiFilterOnly,
        recordingOnly: recordingFilterOnly,
        mobileOnly: mobileFilterOnly,
      },
    );
  }, [
    rawCameras,
    statusFilter,
    siteFilter,
    floorFilter,
    sourceTypeFilter,
    searchQuery,
    aiFilterOnly,
    recordingFilterOnly,
    mobileFilterOnly,
  ]);

  // Selected Camera Object
  const selectedCamera = useMemo(() => {
    if (!selectedCameraId) return null;
    return rawCameras.find(
      (c) => c.cameraCode === selectedCameraId || c.id === selectedCameraId || c.cameraId === selectedCameraId,
    ) || null;
  }, [rawCameras, selectedCameraId]);

  // Map Center: focus on selected camera or default
  const mapCenter = useMemo<[number, number]>(() => {
    if (selectedCamera && selectedCamera.coords && selectedCamera.coords[0] !== 0) {
      return getCameraCoords(selectedCamera);
    }
    return [-74.006, 40.7128]; // Default Metro Central NYC
  }, [selectedCamera]);

  // Active Case for Case Overlay
  const activeCase = useMemo(() => {
    return cases.find((c) => c.id === activeCaseId) || cases[0];
  }, [cases, activeCaseId]);

  // Bulk actions handlers
  const handleBulkEnableAi = () => {
    bulkUpdateAiPolicy(selectedCameraIds, true);
    setSelectedCameraIds([]);
  };

  const handleExportCsv = () => {
    const rows = filteredCameras
      .filter((c) => selectedCameraIds.length === 0 || selectedCameraIds.includes(c.id))
      .map((c) => `"${c.cameraCode || c.id}","${c.name}","${c.siteName || c.locationName}","${c.status}","${c.fps}","${c.bitrateKbps || 0}","${c.rtspUrl}"`);
    const csvContent = 'data:text/csv;charset=utf-8,Code,Name,Site,Status,FPS,Bitrate,RTSP\n' + rows.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'sentinel_camera_fleet.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Map click handler (for camera selection, topology linking, or camera placement)
  const handleMapClick = (coords: { lng: number; lat: number }) => {
    if (placingCamera) {
      // Place unplaced camera at clicked point
      placeCameraInStore(placingCamera.id, [coords.lat, coords.lng], 45, 75);
      setPlacingCamera(null);
      handleSelectCamera(placingCamera);
    }
  };

  const handleCameraMarkerClick = (cam: Camera) => {
    if (isTopologyMode) {
      if (!edgeStartCam) {
        setEdgeStartCam(cam);
      } else if (edgeStartCam.id !== cam.id) {
        setEdgeEndCam(cam);
      }
      return;
    }
    handleSelectCamera(cam);
  };

  // Wall mode auto-rotate timer
  useEffect(() => {
    if (view !== 'wall' || !wallAutoRotate) return;
    const interval = setInterval(() => {
      setWallPageIndex((p) => p + 1);
    }, 10000);
    return () => clearInterval(interval);
  }, [view, wallAutoRotate]);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden select-none bg-background">
      {/* ================= 1. PAGE HEADER ================= */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 border-b border-border bg-card shrink-0">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Video className="h-5 w-5 text-primary" />
            Cameras
          </h1>
          <p className="text-xs text-muted-foreground font-mono">
            {totalCount} cameras · {availableSites.length} sites · {liveCount} operational feeds
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant={isTopologyMode ? 'default' : 'outline'}
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={isTopologyMode ? handleExitTopologyMode : handleEnterTopologyMode}
          >
            <Network className="h-3.5 w-3.5" />
            {isTopologyMode ? 'Exit Topology' : 'Edit Topology'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => setIsBandwidthSheetOpen(true)}
          >
            <Activity className="h-3.5 w-3.5 text-emerald-500" />
            Bandwidth & health
          </Button>

          <Button
            variant={view === 'wall' ? 'secondary' : 'outline'}
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => handleViewChange(view === 'wall' ? 'split' : 'wall')}
          >
            <Maximize2 className="h-3.5 w-3.5" />
            Live wall
          </Button>

          <Button
            variant="default"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => setIsAddWizardOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Add camera
          </Button>
        </div>
      </div>

      {/* ================= 2. TOOLBAR & CONTROLS ================= */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-2.5 border-b border-border bg-muted/30 shrink-0 text-xs">
        {/* Left Filter Controls */}
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-[300px]">
          {/* Search Box */}
          <div className="relative w-48 sm:w-60">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search code, name, zone..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                updateUrlParam('q', e.target.value);
              }}
              className="h-8 pl-8 text-xs bg-background"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  updateUrlParam('q', null);
                }}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Site Select */}
          <Select
            value={siteFilter}
            onValueChange={(val) => {
              setSiteFilter(val);
              updateUrlParam('site', val);
            }}
          >
            <SelectTrigger className="h-8 w-40 text-xs bg-background">
              <SelectValue placeholder="All Sites" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sites ({totalCount})</SelectItem>
              {availableSites.map((site) => (
                <SelectItem key={site.id} value={site.id}>
                  {site.name} ({site.count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Source Type Select */}
          <Select
            value={sourceTypeFilter}
            onValueChange={(val) => {
              setSourceTypeFilter(val);
              updateUrlParam('type', val);
            }}
          >
            <SelectTrigger className="h-8 w-36 text-xs bg-background">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="cctv_rtsp">CCTV (RTSP)</SelectItem>
              <SelectItem value="cctv_onvif">ONVIF</SelectItem>
              <SelectItem value="mobile_webrtc">Mobile Phone</SelectItem>
              <SelectItem value="usb_webcam">USB Webcam</SelectItem>
              <SelectItem value="file_upload">Video Upload</SelectItem>
            </SelectContent>
          </Select>

          {/* Floor Chips */}
          <div className="flex items-center rounded-md border border-border p-0.5 bg-background">
            {(['all', -1, 1, 2] as const).map((fl) => (
              <button
                key={String(fl)}
                type="button"
                onClick={() => {
                  setFloorFilter(fl);
                  updateUrlParam('floor', String(fl));
                }}
                className={cn(
                  'px-2 py-0.5 rounded text-[11px] font-mono transition-colors',
                  floorFilter === fl ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {fl === 'all' ? 'All' : fl === -1 ? 'B1' : `L${fl}`}
              </button>
            ))}
          </div>

          {/* Status Filter Chips with Derived Live Counts */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setStatusFilter('all');
                updateUrlParam('status', 'all');
              }}
              className={cn(
                'px-2 py-1 rounded-md text-[11px] font-medium border transition-colors',
                statusFilter === 'all' ? 'border-foreground bg-foreground text-background font-semibold' : 'border-border bg-background text-muted-foreground hover:text-foreground',
              )}
            >
              All {totalCount}
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusFilter('live');
                updateUrlParam('status', 'live');
              }}
              className={cn(
                'px-2 py-1 rounded-md text-[11px] font-medium border transition-colors flex items-center gap-1',
                statusFilter === 'live' ? 'border-emerald-500 bg-emerald-500 text-white font-semibold' : 'border-border bg-background text-emerald-600 hover:border-emerald-500',
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Live {liveCount}
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusFilter('degraded');
                updateUrlParam('status', 'degraded');
              }}
              className={cn(
                'px-2 py-1 rounded-md text-[11px] font-medium border transition-colors flex items-center gap-1',
                statusFilter === 'degraded' ? 'border-amber-500 bg-amber-500 text-white font-semibold' : 'border-border bg-background text-amber-600 hover:border-amber-500',
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              Degraded {degradedCount}
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusFilter('offline');
                updateUrlParam('status', 'offline');
              }}
              className={cn(
                'px-2 py-1 rounded-md text-[11px] font-medium border transition-colors flex items-center gap-1',
                statusFilter === 'offline' ? 'border-rose-500 bg-rose-500 text-white font-semibold' : 'border-border bg-background text-rose-600 hover:border-rose-500',
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
              Offline {offlineCount}
            </button>
          </div>

          {/* Quick Toggle Filters */}
          <div className="flex items-center gap-1 pl-1 border-l border-border">
            <Button
              variant={aiFilterOnly ? 'secondary' : 'ghost'}
              size="sm"
              className={cn('h-7 text-[11px] px-2 gap-1', aiFilterOnly && 'bg-primary/10 text-primary border border-primary/20')}
              onClick={() => setAiFilterOnly(!aiFilterOnly)}
            >
              <Zap className="h-3 w-3 text-primary" />
              AI On
            </Button>
            <Button
              variant={recordingFilterOnly ? 'secondary' : 'ghost'}
              size="sm"
              className={cn('h-7 text-[11px] px-2 gap-1', recordingFilterOnly && 'bg-primary/10 text-primary border border-primary/20')}
              onClick={() => setRecordingFilterOnly(!recordingFilterOnly)}
            >
              <Radio className="h-3 w-3 text-emerald-500" />
              Recording
            </Button>
            <Button
              variant={mobileFilterOnly ? 'secondary' : 'ghost'}
              size="sm"
              className={cn('h-7 text-[11px] px-2 gap-1', mobileFilterOnly && 'bg-primary/10 text-primary border border-primary/20')}
              onClick={() => setMobileFilterOnly(!mobileFilterOnly)}
            >
              <Smartphone className="h-3 w-3 text-blue-500" />
              Mobile
            </Button>
          </div>
        </div>

        {/* Right Controls: Layer Popover & View Switcher */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Layer Popover (available on split and map views) */}
          {(view === 'split' || view === 'map') && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                  <Layers className="h-3.5 w-3.5" />
                  Layers
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-3 space-y-2 text-xs" align="end">
                <span className="font-semibold text-foreground block">Map Layers</span>
                <div className="space-y-1.5">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span>FOV Coverage Cones</span>
                    <Switch checked={showFov} onCheckedChange={setShowFov} />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span>Transitions (Topology)</span>
                    <Switch checked={showTopology} onCheckedChange={setShowTopology} />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span>Density Heatmap</span>
                    <Switch checked={showHeatmap} onCheckedChange={setShowHeatmap} />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span>Marker Clustering</span>
                    <Switch checked={showClusters} onCheckedChange={setShowClusters} />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span>Active ByteTrack Dots</span>
                    <Switch checked={showActiveTracks} onCheckedChange={setShowActiveTracks} />
                  </label>
                  <div className="pt-2 border-t border-border">
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="font-medium text-amber-500">Active Case Overlay</span>
                      <Switch checked={showCaseOverlay} onCheckedChange={setShowCaseOverlay} />
                    </label>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}

          {/* View Mode Switcher */}
          <div className="flex items-center rounded-lg border border-border p-0.5 bg-background">
            <button
              type="button"
              onClick={() => handleViewChange('split')}
              className={cn(
                'p-1.5 rounded-md text-xs transition-colors flex items-center gap-1',
                view === 'split' ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:text-foreground',
              )}
              title="Split View (Map + Cards)"
            >
              <Columns2 className="h-3.5 w-3.5" />
              <span className="hidden xl:inline text-[11px]">Split</span>
            </button>
            <button
              type="button"
              onClick={() => handleViewChange('grid')}
              className={cn(
                'p-1.5 rounded-md text-xs transition-colors flex items-center gap-1',
                view === 'grid' ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:text-foreground',
              )}
              title="Card Grid View"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="hidden xl:inline text-[11px]">Grid</span>
            </button>
            <button
              type="button"
              onClick={() => handleViewChange('table')}
              className={cn(
                'p-1.5 rounded-md text-xs transition-colors flex items-center gap-1',
                view === 'table' ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:text-foreground',
              )}
              title="Dense Table View"
            >
              <List className="h-3.5 w-3.5" />
              <span className="hidden xl:inline text-[11px]">Table</span>
            </button>
            <button
              type="button"
              onClick={() => handleViewChange('map')}
              className={cn(
                'p-1.5 rounded-md text-xs transition-colors flex items-center gap-1',
                view === 'map' ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:text-foreground',
              )}
              title="Full Map View"
            >
              <MapIcon className="h-3.5 w-3.5" />
              <span className="hidden xl:inline text-[11px]">Map</span>
            </button>
          </div>
        </div>
      </div>

      {/* Topology Edit Mode Alert Banner */}
      {isTopologyMode && (
        <div className="px-6 py-2 shrink-0">
          <TopologyEditBanner
            onExitTopologyMode={handleExitTopologyMode}
            selectedEdge={selectedEdge}
            onSelectEdge={setSelectedEdge}
            edgeStartCamera={edgeStartCam}
            edgeEndCamera={edgeEndCam}
            onClearEdgeSelection={() => {
              setEdgeStartCam(null);
              setEdgeEndCam(null);
            }}
          />
        </div>
      )}

      {/* ================= 3. MAIN CONTENT VIEWS ================= */}
      <div className="flex-1 relative overflow-hidden flex">
        {/* ================= VIEW 1: SPLIT (DEFAULT) ================= */}
        {view === 'split' && (
          <div className="flex-1 flex w-full h-full overflow-hidden">
            {/* Left 60%: Map */}
            <div className="relative flex-1 h-full border-r border-border">
              <SentinelMap
                center={mapCenter}
                zoom={14}
                className="w-full h-full"
              >
                {/* Cameras Layer */}
                <CameraLayer
                  cameras={filteredCameras}
                  selectedCameraId={selectedCamera?.id}
                  onSelectCamera={handleCameraMarkerClick}
                  enableClustering={showClusters}
                  showTooltip={true}
                />

                {/* FOV Cones */}
                {showFov && (
                  <CameraFovLayer
                    cameras={filteredCameras}
                    selectedCameraId={selectedCamera?.id}
                  />
                )}

                {/* Topology Transition Edges */}
                {showTopology && (
                  <TopologyLayer
                    cameras={rawCameras}
                    transitions={topologyTransitions}
                    selectedTransition={selectedEdge}
                    onSelectTransition={setSelectedEdge}
                  />
                )}

                {/* Density Heatmap */}
                {showHeatmap && (
                  <DetectionHeatmapLayer
                    cameras={filteredCameras}
                  />
                )}

                {/* Realtime Pulsing Tracks */}
                {showActiveTracks && (
                  <RealtimeTrackLayer
                    tracks={[]}
                  />
                )}

                {/* Active Case Reachable Area Overlay */}
                {showCaseOverlay && (
                  <LastKnownLayer
                    center={[-73.98513, 40.758896]}
                    lastSeenTimestamp={activeCase.lastSeenAt}
                    locationName={activeCase.lastSeenLocation}
                    cameras={filteredCameras}
                    onSuggestedCameraClick={handleSelectCamera}
                  />
                )}
              </SentinelMap>

              {/* Unplaced Cameras Tray */}
              <UnplacedCamerasTray
                onStartPlacingCamera={(cam) => setPlacingCamera(cam)}
                placingCameraId={placingCamera?.id}
              />
            </div>

            {/* Right 40%: Camera Cards List or Detail Panel */}
            <div className="w-[420px] xl:w-[480px] h-full shrink-0 flex flex-col bg-card overflow-hidden">
              {selectedCamera ? (
                <CameraDetailPanel
                  camera={selectedCamera}
                  onClose={() => handleSelectCamera(null)}
                  onSelectCameraById={(id) => {
                    const target = rawCameras.find((c) => c.id === id || c.cameraCode === id);
                    if (target) handleSelectCamera(target);
                  }}
                  onEnterTopologyEdit={handleEnterTopologyMode}
                  onOpenLiveWall={() => handleViewChange('wall')}
                />
              ) : (
                <div className="flex-1 flex flex-col h-full overflow-hidden">
                  <div className="p-3 border-b border-border bg-muted/20 flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground">
                      Camera Fleet List ({filteredCameras.length})
                    </span>
                    <span className="text-muted-foreground font-mono text-[11px]">
                      Click camera to open full telemetry
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                    {filteredCameras.map((cam) => {
                      const isCamLive = cam.status === 'live';
                      const isCamOffline = cam.status === 'offline';
                      const isCamDegraded = cam.status === 'degraded';
                      const isHovered = hoveredCameraId === cam.id;

                      return (
                        <div
                          key={cam.id}
                          onMouseEnter={() => setHoveredCameraId(cam.id)}
                          onMouseLeave={() => setHoveredCameraId(null)}
                          onClick={() => handleSelectCamera(cam)}
                          className={cn(
                            'p-3 rounded-xl border border-border bg-card transition-all cursor-pointer hover:border-foreground/60 hover:shadow-md space-y-2',
                            isHovered && 'border-primary ring-1 ring-primary/40',
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-xs font-bold text-foreground">
                                  {cam.cameraCode || cam.id}
                                </span>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    'text-[9px] font-semibold h-4 px-1.5 uppercase',
                                    isCamLive && 'border-emerald-500 text-emerald-500 bg-emerald-500/10',
                                    isCamDegraded && 'border-amber-500 text-amber-500 bg-amber-500/10',
                                    isCamOffline && 'border-rose-500 text-rose-500 bg-rose-500/10',
                                  )}
                                >
                                  {cam.status}
                                </Badge>
                                {cam.sourceType === 'mobile_webrtc' && (
                                  <Smartphone className="h-3 w-3 text-blue-500" />
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground font-medium block truncate max-w-[240px]">
                                {cam.name}
                              </span>
                            </div>

                            <span className="font-mono text-[11px] text-muted-foreground">
                              {cam.fps} fps · {cam.bitrateKbps || 4096}k
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/50">
                            <span className="truncate max-w-[200px]">{cam.siteName || cam.locationName}</span>
                            <span className="font-mono">
                              Floor {cam.floor !== undefined ? (cam.floor >= 0 ? `L${cam.floor}` : `B${Math.abs(cam.floor)}`) : 'G'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= VIEW 2: GRID ================= */}
        {view === 'grid' && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredCameras.map((cam, idx) => {
                const isCamLive = cam.status === 'live';
                const isCamOffline = cam.status === 'offline';
                const isCamDegraded = cam.status === 'degraded';
                // Only first 16 live cameras play live WebRTC substream concurrently
                const canStreamWebRtc = isCamLive && idx < 16;

                return (
                  <div
                    key={cam.id}
                    className="flex flex-col rounded-xl border border-border bg-card overflow-hidden shadow-sm hover:border-foreground/50 transition-all group"
                  >
                    {/* 16:9 Thumbnail / Substream Tile */}
                    <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
                      {isCamOffline ? (
                        <div className="relative w-full h-full flex flex-col items-center justify-center p-3">
                          {cam.thumbnailUrl && (
                            <img
                              src={cam.thumbnailUrl}
                              alt=""
                              className="absolute inset-0 w-full h-full object-cover filter brightness-30 grayscale"
                            />
                          )}
                          <div className="relative z-10 flex flex-col items-center gap-1 text-center">
                            <WifiOff className="h-5 w-5 text-rose-500" />
                            <span className="text-[11px] font-semibold text-white">Offline</span>
                            <span className="text-[9px] text-muted-foreground">Last frame 14m ago</span>
                          </div>
                        </div>
                      ) : canStreamWebRtc ? (
                        <CameraPlayer
                          cameraId={cam.id}
                          name={cam.name}
                          quality="low"
                          showControls={false}
                          showAiOverlays={isCamLive && !!cam.aiPolicy?.enabled}
                          fallbackPosterUrl={cam.thumbnailUrl}
                        />
                      ) : (
                        <div className="relative w-full h-full">
                          <img
                            src={cam.thumbnailUrl || 'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?auto=format&fit=crop&w=400&q=80'}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute bottom-1 right-1 bg-black/60 px-1 py-0.5 rounded text-[9px] font-mono text-white">
                            2s Snapshot
                          </div>
                        </div>
                      )}

                      {/* Header Overlays on Tile */}
                      <div className="absolute top-2 left-2 flex items-center gap-1.5 z-10">
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[9px] font-semibold uppercase px-1.5 h-4 bg-background/90 backdrop-blur',
                            isCamLive && 'border-emerald-500 text-emerald-500',
                            isCamDegraded && 'border-amber-500 text-amber-500',
                            isCamOffline && 'border-rose-500 text-rose-500',
                          )}
                        >
                          {cam.status}
                        </Badge>
                        <span className="font-mono text-[10px] font-bold text-white bg-black/60 px-1.5 py-0.5 rounded backdrop-blur">
                          {cam.cameraCode || cam.id}
                        </span>
                      </div>

                      <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
                        <span className="text-[9px] font-mono text-white bg-black/60 px-1.5 py-0.5 rounded backdrop-blur">
                          {cam.resolution?.includes('4K') ? '4K' : 'FHD'}
                        </span>
                      </div>
                    </div>

                    {/* Metadata Card Footer */}
                    <div className="p-3 space-y-2 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-foreground truncate max-w-[180px]">
                            {cam.name}
                          </span>
                          {cam.sourceType === 'mobile_webrtc' && (
                            <Smartphone className="h-3.5 w-3.5 text-blue-500" />
                          )}
                        </div>
                        <span className="text-[11px] text-muted-foreground block truncate">
                          {cam.siteName || cam.locationName} · Zone {cam.zone.split(' - ')[0]}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono pt-1 border-t border-border/50">
                        <span>{cam.fps} fps · {cam.health?.packetLoss ?? 0}% loss</span>
                        <div className="flex items-center gap-1">
                          <Switch
                            checked={cam.aiPolicy?.enabled ?? true}
                            onCheckedChange={(val) =>
                              updateCamera(cam.id, {
                                aiPolicy: {
                                  ...(cam.aiPolicy || { sampleFps: 2.0, minDetectionConf: 0.65 }),
                                  enabled: val,
                                },
                              })
                            }
                            className="scale-75"
                            title="Toggle AI Inference"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[11px] flex-1"
                          onClick={() => handleSelectCamera(cam)}
                        >
                          Open
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[11px] flex-1"
                          onClick={() => handleSelectCamera(cam)}
                        >
                          Playback
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= VIEW 3: TABLE ================= */}
        {view === 'table' && (
          <div className="flex-1 overflow-y-auto p-6 flex flex-col justify-between">
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <Table className="text-xs">
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={
                          selectedCameraIds.length > 0 &&
                          selectedCameraIds.length === filteredCameras.length
                        }
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedCameraIds(filteredCameras.map((c) => c.id));
                          } else {
                            setSelectedCameraIds([]);
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead className="w-24">Status</TableHead>
                    <TableHead className="w-28">Code</TableHead>
                    <TableHead>Camera Name</TableHead>
                    <TableHead>Site / Zone</TableHead>
                    <TableHead className="w-16">Floor</TableHead>
                    <TableHead className="w-24">Type</TableHead>
                    <TableHead className="w-16">FPS</TableHead>
                    <TableHead className="w-24">Bitrate</TableHead>
                    <TableHead className="w-24">Resolution</TableHead>
                    <TableHead className="w-20">AI Policy</TableHead>
                    <TableHead className="text-right w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCameras.map((cam) => {
                    const isSelected = selectedCameraIds.includes(cam.id);
                    const isCamLive = cam.status === 'live';
                    const isCamOffline = cam.status === 'offline';
                    const isCamDegraded = cam.status === 'degraded';

                    return (
                      <TableRow
                        key={cam.id}
                        className={cn(
                          'hover:bg-muted/30 cursor-pointer',
                          isSelected && 'bg-primary/5',
                        )}
                        onClick={() => handleSelectCamera(cam)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedCameraIds([...selectedCameraIds, cam.id]);
                              } else {
                                setSelectedCameraIds(selectedCameraIds.filter((id) => id !== cam.id));
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px] font-semibold uppercase px-1.5 h-4',
                              isCamLive && 'border-emerald-500 text-emerald-500 bg-emerald-500/10',
                              isCamDegraded && 'border-amber-500 text-amber-500 bg-amber-500/10',
                              isCamOffline && 'border-rose-500 text-rose-500 bg-rose-500/10',
                            )}
                          >
                            {cam.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono font-bold text-foreground">
                          {cam.cameraCode || cam.id}
                        </TableCell>
                        <TableCell className="font-medium text-foreground">
                          {cam.name}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {cam.siteName || cam.locationName} · {cam.zone}
                        </TableCell>
                        <TableCell className="font-mono text-muted-foreground">
                          {cam.floor !== undefined ? (cam.floor >= 0 ? `L${cam.floor}` : `B${Math.abs(cam.floor)}`) : 'G'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px]">
                            {cam.sourceType || 'cctv_rtsp'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono">{cam.fps}</TableCell>
                        <TableCell className="font-mono">{cam.bitrateKbps || 4096}k</TableCell>
                        <TableCell className="font-mono text-[11px] text-muted-foreground">
                          {cam.resolution || '1080p'}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Switch
                            checked={cam.aiPolicy?.enabled ?? true}
                            onCheckedChange={(val) =>
                              updateCamera(cam.id, {
                                aiPolicy: {
                                  ...(cam.aiPolicy || { sampleFps: 2.0, minDetectionConf: 0.65 }),
                                  enabled: val,
                                },
                              })
                            }
                            className="scale-75"
                          />
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => handleSelectCamera(cam)}
                          >
                            Open
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Lasso / Bulk Actions Floating Bar */}
            <LassoActionBar
              selectedCameraIds={selectedCameraIds}
              onClearSelection={() => setSelectedCameraIds([])}
              onBulkEnableAi={handleBulkEnableAi}
              onBulkAddToWall={() => handleViewChange('wall')}
              onExportCsv={handleExportCsv}
            />
          </div>
        )}

        {/* ================= VIEW 4: MAP (FULL WIDTH) ================= */}
        {view === 'map' && (
          <div className="flex-1 relative w-full h-full">
            <SentinelMap
              center={mapCenter}
              zoom={14}
              className="w-full h-full"
            >
              <CameraLayer
                cameras={filteredCameras}
                selectedCameraId={selectedCamera?.id}
                onSelectCamera={handleCameraMarkerClick}
                enableClustering={showClusters}
                showTooltip={true}
              />

              {showFov && (
                <CameraFovLayer
                  cameras={filteredCameras}
                  selectedCameraId={selectedCamera?.id}
                />
              )}

              {showTopology && (
                <TopologyLayer
                  cameras={rawCameras}
                  transitions={topologyTransitions}
                  selectedTransition={selectedEdge}
                  onSelectTransition={setSelectedEdge}
                />
              )}

              {showHeatmap && (
                <DetectionHeatmapLayer
                  cameras={filteredCameras}
                />
              )}

              {showActiveTracks && (
                <RealtimeTrackLayer
                  tracks={[]}
                />
              )}

              {showCaseOverlay && (
                <LastKnownLayer
                  center={[-73.98513, 40.758896]}
                  lastSeenTimestamp={activeCase.lastSeenAt}
                  locationName={activeCase.lastSeenLocation}
                  cameras={filteredCameras}
                  onSuggestedCameraClick={handleSelectCamera}
                />
              )}
            </SentinelMap>

            {/* Unplaced Cameras Tray */}
            <UnplacedCamerasTray
              onStartPlacingCamera={(cam) => setPlacingCamera(cam)}
              placingCameraId={placingCamera?.id}
            />

            {/* Slide-over Detail Drawer when camera selected */}
            {selectedCamera && (
              <div className="absolute top-0 right-0 bottom-0 w-[420px] xl:w-[480px] z-30 shadow-2xl">
                <CameraDetailPanel
                  camera={selectedCamera}
                  onClose={() => handleSelectCamera(null)}
                  onSelectCameraById={(id) => {
                    const target = rawCameras.find((c) => c.id === id || c.cameraCode === id);
                    if (target) handleSelectCamera(target);
                  }}
                  onEnterTopologyEdit={handleEnterTopologyMode}
                  onOpenLiveWall={() => handleViewChange('wall')}
                />
              </div>
            )}
          </div>
        )}

        {/* ================= VIEW 5: WALL ================= */}
        {view === 'wall' && (
          <div className="flex-1 flex flex-col h-full bg-black text-white p-4 space-y-3 overflow-hidden select-none">
            {/* Wall Control Toolbar */}
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs shrink-0">
              <div className="flex items-center gap-3">
                <span className="font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Maximize2 className="h-4 w-4 text-primary" />
                  Live Wall Monitor
                </span>

                {/* Preset Switcher */}
                <div className="flex items-center rounded-md border border-zinc-700 p-0.5 bg-black">
                  {(['1x1', '2x2', '3x3', '4x4', 'focus'] as WallLayout[]).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setWallLayout(preset)}
                      className={cn(
                        'px-2 py-0.5 rounded text-[11px] font-mono transition-colors',
                        wallLayout === preset ? 'bg-primary text-white font-bold' : 'text-zinc-400 hover:text-white',
                      )}
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 pl-2 border-l border-zinc-800">
                  <Label htmlFor="wall-autorotate" className="text-[11px] text-zinc-300 cursor-pointer">
                    Auto-Rotate (10s)
                  </Label>
                  <Switch
                    id="wall-autorotate"
                    checked={wallAutoRotate}
                    onCheckedChange={setWallAutoRotate}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs border-zinc-700 text-zinc-300 hover:text-white"
                  onClick={() => handleViewChange('split')}
                >
                  Exit Wall
                </Button>
              </div>
            </div>

            {/* Wall Tile Matrix */}
            <div
              className={cn(
                'flex-1 grid gap-2 overflow-hidden',
                wallLayout === '1x1' && 'grid-cols-1 grid-rows-1',
                wallLayout === '2x2' && 'grid-cols-2 grid-rows-2',
                wallLayout === '3x3' && 'grid-cols-3 grid-rows-3',
                wallLayout === '4x4' && 'grid-cols-4 grid-rows-4',
                wallLayout === 'focus' && 'grid-cols-4 grid-rows-3',
              )}
            >
              {filteredCameras
                .filter((c) => c.status !== 'offline')
                .slice(
                  wallLayout === '1x1'
                    ? wallPageIndex % filteredCameras.length
                    : (wallPageIndex * 4) % Math.max(1, filteredCameras.length - 4),
                  wallLayout === '1x1'
                    ? (wallPageIndex % filteredCameras.length) + 1
                    : wallLayout === '2x2'
                    ? ((wallPageIndex * 4) % Math.max(1, filteredCameras.length - 4)) + 4
                    : wallLayout === '3x3'
                    ? ((wallPageIndex * 4) % Math.max(1, filteredCameras.length - 4)) + 9
                    : ((wallPageIndex * 4) % Math.max(1, filteredCameras.length - 4)) + 16,
                )
                .map((cam, idx) => (
                  <div
                    key={cam.id}
                    className={cn(
                      'relative rounded-lg overflow-hidden border border-zinc-800 bg-zinc-950 flex items-center justify-center group',
                      cam.activeDetections && cam.activeDetections > 0 && 'ring-2 ring-rose-500 animate-pulse',
                      wallLayout === 'focus' && idx === 0 && 'col-span-3 row-span-3',
                    )}
                  >
                    <CameraPlayer
                      cameraId={cam.id}
                      name={cam.name}
                      quality={idx === 0 ? 'high' : 'low'}
                      showControls={false}
                      showAiOverlays={true}
                      fallbackPosterUrl={cam.thumbnailUrl}
                    />

                    {/* Camera Badge Overlay */}
                    <div className="absolute top-2 left-2 z-20 flex items-center gap-1.5 px-2 py-0.5 rounded bg-black/80 border border-white/20 text-[10px] text-white font-mono">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>{cam.cameraCode || cam.id}</span>
                      <span className="text-zinc-400">· {cam.name}</span>
                    </div>

                    {cam.activeDetections && cam.activeDetections > 0 && (
                      <div className="absolute bottom-2 right-2 z-20 px-2 py-0.5 rounded bg-rose-600 text-white font-bold text-[10px] animate-bounce">
                        ACTIVE TARGET SIGHTING
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Add Camera Wizard Sheet/Dialog */}
      <AddCameraWizard
        open={isAddWizardOpen}
        onOpenChange={setIsAddWizardOpen}
      />

      {/* Bandwidth & Ingestion Health Sheet */}
      <BandwidthHealthSheet
        open={isBandwidthSheetOpen}
        onOpenChange={setIsBandwidthSheetOpen}
      />
    </div>
  );
}

export default function CamerasPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-muted-foreground font-mono">Loading Camera Fleet Hub...</div>}>
      <CamerasPageContent />
    </Suspense>
  );
}
