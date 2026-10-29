'use client';

import React, { useState, useEffect } from 'react';
import { Camera } from '@/types';
import { cameraService } from '@/services/camera.service';
import { CameraPlayer } from '@/components/features/cameras/CameraPlayer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Layers,
  Grid,
  Maximize2,
  Minimize2,
  Eye,
  EyeOff,
  Sliders,
  Volume2,
  VolumeX,
  Plus,
  RotateCw,
  Bookmark,
  Check,
  ChevronLeft,
} from 'lucide-react';
import Link from 'next/link';

type GridSize = 1 | 4 | 9 | 16;

const LAYOUT_PRESETS: Record<string, string[]> = {
  'Terminal 1 & Transit': ['cam_01', 'cam_02', 'cam_03', 'cam_04', 'cam_07', 'cam_08', 'cam_09', 'cam_10', 'cam_11'],
  'Perimeter & Exits': ['cam_04', 'cam_12', 'cam_15', 'cam_18'],
  'High-Traffic Hubs': ['cam_01', 'cam_02', 'cam_05', 'cam_06'],
  'Comprehensive 16': Array.from({ length: 16 }, (_, i) => `cam_${String(i + 1).padStart(2, '0')}`),
};

export default function CameraWallPage() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [gridSize, setGridSize] = useState<GridSize>(4);
  const [assignedCameraIds, setAssignedCameraIds] = useState<string[]>([]);
  const [focusedCameraId, setFocusedCameraId] = useState<string | null>(null);
  const [globalAiOverlays, setGlobalAiOverlays] = useState(true);
  const [activePreset, setActivePreset] = useState<string>('Terminal 1 & Transit');

  // Slot selector dialog state
  const [selectorSlotIndex, setSelectorSlotIndex] = useState<number | null>(null);

  useEffect(() => {
    const fetchCameras = async () => {
      try {
        const data = await cameraService.getAll();
        setCameras(data);
        // Default initial slot assignments from preset
        const defaultIds = LAYOUT_PRESETS['Terminal 1 & Transit'].slice(0, 4);
        setAssignedCameraIds(defaultIds);
      } catch (err) {
        console.error('Failed to load cameras for wall:', err);
      }
    };
    fetchCameras();
  }, []);

  const handleGridSizeChange = (size: GridSize) => {
    setGridSize(size);
    setFocusedCameraId(null);

    // Expand or truncate assignments
    if (assignedCameraIds.length < size) {
      const current = [...assignedCameraIds];
      const available = cameras.map((c) => c.id).filter((id) => !current.includes(id));
      const needed = size - current.length;
      setAssignedCameraIds([...current, ...available.slice(0, needed)]);
    }
  };

  const applyPreset = (presetName: string) => {
    setActivePreset(presetName);
    const ids = LAYOUT_PRESETS[presetName] || [];
    setAssignedCameraIds(ids.slice(0, gridSize));
    setFocusedCameraId(null);
  };

  const assignCameraToSlot = (slotIndex: number, cameraId: string) => {
    const next = [...assignedCameraIds];
    next[slotIndex] = cameraId;
    setAssignedCameraIds(next);
    setSelectorSlotIndex(null);
  };

  const getGridColsClass = () => {
    if (focusedCameraId) return 'grid-cols-1';
    switch (gridSize) {
      case 1:
        return 'grid-cols-1';
      case 4:
        return 'grid-cols-2';
      case 9:
        return 'grid-cols-3';
      case 16:
        return 'grid-cols-4';
    }
  };

  const displaySlots = focusedCameraId
    ? [focusedCameraId]
    : assignedCameraIds.slice(0, gridSize);

  return (
    <div className="flex flex-col h-[calc(100vh-4.5rem)] space-y-3">
      {/* Wall Header & Performance Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-2.5 rounded-lg border">
        <div className="flex items-center gap-3">
          <Link href="/cameras">
            <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs">
              <ChevronLeft className="h-3.5 w-3.5" /> Fleet
            </Button>
          </Link>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-cyan-400" />
            <h1 className="text-sm font-bold tracking-tight">Multi-Grid Surveillance Wall</h1>
          </div>
          <Badge variant="outline" className="text-[10px] font-mono text-cyan-400 border-cyan-500/40">
            {gridSize} Tiles ({focusedCameraId ? 'FOCUSED 1x1' : `${Math.sqrt(gridSize)}x${Math.sqrt(gridSize)}`})
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {/* Preset Selector */}
          <Select value={activePreset} onValueChange={applyPreset}>
            <SelectTrigger className="w-[160px] h-8 text-xs bg-muted/40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(LAYOUT_PRESETS).map((p) => (
                <SelectItem key={p} value={p} className="text-xs">
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Grid Size Selectors */}
          <div className="flex items-center rounded-md border border-input p-0.5 bg-muted/40">
            {([1, 4, 9, 16] as GridSize[]).map((sz) => (
              <Button
                key={sz}
                size="sm"
                variant={gridSize === sz && !focusedCameraId ? 'secondary' : 'ghost'}
                onClick={() => handleGridSizeChange(sz)}
                className="h-7 px-2 text-xs font-mono"
              >
                {sz === 1 ? '1x1' : sz === 4 ? '2x2' : sz === 9 ? '3x3' : '4x4'}
              </Button>
            ))}
          </div>

          {/* Global AI Overlay Toggle */}
          <Button
            size="sm"
            variant={globalAiOverlays ? 'default' : 'outline'}
            onClick={() => setGlobalAiOverlays(!globalAiOverlays)}
            className="h-8 text-xs gap-1.5 font-mono"
            title="Toggle AI Detection Overlays Across All Tiles"
          >
            {globalAiOverlays ? <Eye className="h-3.5 w-3.5 text-cyan-300" /> : <EyeOff className="h-3.5 w-3.5" />}
            AI Overlays
          </Button>

          {/* Exit Focus Mode Button */}
          {focusedCameraId && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setFocusedCameraId(null)}
              className="h-8 text-xs gap-1"
            >
              <Minimize2 className="h-3.5 w-3.5" /> Return to Grid
            </Button>
          )}
        </div>
      </div>

      {/* Grid Canvas */}
      <div className={`flex-1 grid gap-2.5 overflow-hidden ${getGridColsClass()}`}>
        {displaySlots.map((camId, idx) => {
          const cam = cameras.find((c) => c.id === camId);
          const isFocused = focusedCameraId === camId;

          return (
            <div
              key={`${camId}_${idx}`}
              className="relative h-full w-full rounded-lg overflow-hidden border border-zinc-800 bg-zinc-950 group"
            >
              <CameraPlayer
                cameraId={camId}
                name={cam?.name || camId}
                // Wall Rule: Low quality substream for grid tiles; high quality for focused tile
                quality={isFocused ? 'high' : 'low'}
                showAiOverlays={globalAiOverlays}
                aspectRatio="fill"
                className="h-full w-full"
                fallbackPosterUrl={cam?.thumbnailUrl}
              />

              {/* Slot Switcher / Focus Overlay Controls (Top Right) */}
              <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20 bg-black/70 p-1 rounded backdrop-blur-md">
                {/* Focus / Unfocus */}
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setFocusedCameraId(isFocused ? null : camId)}
                  className="h-6 w-6 text-zinc-300 hover:text-white"
                  title={isFocused ? 'Restore Grid' : 'Focus Stream (High Res)'}
                >
                  {isFocused ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
                </Button>

                {/* Change Camera in Slot */}
                {!isFocused && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setSelectorSlotIndex(idx)}
                    className="h-6 w-6 text-zinc-300 hover:text-white"
                    title="Change Camera Slot"
                  >
                    <Sliders className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Slot Assignment Modal */}
      <Dialog
        open={selectorSlotIndex !== null}
        onOpenChange={(open) => !open && setSelectorSlotIndex(null)}
      >
        <DialogContent className="max-w-md bg-zinc-950 border-zinc-800 text-zinc-100">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">
              Assign Camera to Tile Slot {selectorSlotIndex !== null ? selectorSlotIndex + 1 : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto space-y-1.5 pr-1">
            {cameras.map((c) => (
              <button
                key={c.id}
                onClick={() => selectorSlotIndex !== null && assignCameraToSlot(selectorSlotIndex, c.id)}
                className="w-full flex items-center justify-between p-2.5 rounded-lg border border-zinc-800/80 bg-zinc-900/60 hover:bg-zinc-800/80 text-left transition-colors"
              >
                <div>
                  <span className="text-xs font-semibold text-zinc-200 block">{c.name}</span>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {c.id} • {c.locationName}
                  </span>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono capitalize">
                  {c.status}
                </Badge>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
