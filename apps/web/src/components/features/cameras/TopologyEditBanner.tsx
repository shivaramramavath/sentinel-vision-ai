'use client';

import React, { useState, useMemo } from 'react';
import { Camera, CameraTopologyTransition } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Network,
  Save,
  RotateCcw,
  History,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  ArrowRight,
  ArrowLeftRight,
  Sparkles,
  X,
} from 'lucide-react';
import { useCameraTopology, useCameras, useUpdateTransition } from '@/hooks/use-cameras';
import { camerasApi } from '@/lib/api/cameras.api';
import { cn } from '@/lib/utils';

interface TopologyEditBannerProps {
  onExitTopologyMode: () => void;
  selectedEdge: CameraTopologyTransition | null;
  onSelectEdge: (edge: CameraTopologyTransition | null) => void;
  edgeStartCamera: Camera | null;
  edgeEndCamera: Camera | null;
  onClearEdgeSelection: () => void;
}

export function TopologyEditBanner({
  onExitTopologyMode,
  selectedEdge,
  onSelectEdge,
  edgeStartCamera,
  edgeEndCamera,
  onClearEdgeSelection,
}: TopologyEditBannerProps) {
  const { data: transitions = [] } = useCameraTopology();
  const { data: cameras = [] } = useCameras();
  const version = 1;
  const updateTransitionMutation = useUpdateTransition();

  const addTransition = (dto: any) => {
    camerasApi.updateTopology(dto.fromCamera, dto.toCamera, dto);
  };
  const updateTransition = (from: string, to: string, dto: any) => {
    camerasApi.updateTopology(from, to, dto);
  };
  const deleteTransition = (from: string, to: string) => {
    camerasApi.updateTopology(from, to, { disabled: true });
  };

  // Form states for creating or editing edge
  const [minTravelSec, setMinTravelSec] = useState<string>('45');
  const [maxTravelSec, setMaxTravelSec] = useState<string>('180');
  const [direction, setDirection] = useState<'forward' | 'backward' | 'two_way'>('two_way');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);

  // Validation Warnings
  const warnings = useMemo(() => {
    const list: string[] = [];
    const connectedCamIds = new Set<string>();

    transitions.forEach((t: CameraTopologyTransition) => {
      connectedCamIds.add(t.fromCamera);
      connectedCamIds.add(t.toCamera);

      if (t.distanceMeters && t.minTravelSec < t.distanceMeters / 10) {
        list.push(`Impossible travel speed on ${t.fromCamera} -> ${t.toCamera}: minimum travel time (${t.minTravelSec}s) allows sprinting faster than 10 m/s for ${t.distanceMeters}m.`);
      }
    });

    const placedCameras = cameras.filter((c) => c.coords && c.coords[0] !== 0);
    const isolated = placedCameras.filter(
      (c) => !connectedCamIds.has(c.id) && !connectedCamIds.has(c.cameraCode || ''),
    );

    if (isolated.length > 0) {
      list.push(`${isolated.length} cameras have no physical transit links (isolated nodes).`);
    }

    return list;
  }, [transitions, cameras]);

  // Compute distance between selected cameras
  const calculatedDistanceMeters = useMemo(() => {
    if (!edgeStartCamera?.coords || !edgeEndCamera?.coords) return 90;
    const [lat1, lon1] = edgeStartCamera.coords;
    const [lat2, lon2] = edgeEndCamera.coords;
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  }, [edgeStartCamera, edgeEndCamera]);

  const handleSuggestFromDistance = () => {
    const walkingSpeedMps = 1.3;
    const nominalSec = Math.round(calculatedDistanceMeters / walkingSpeedMps);
    setMinTravelSec(String(Math.max(15, Math.round(nominalSec * 0.7))));
    setMaxTravelSec(String(Math.round(nominalSec * 2.2)));
  };

  const handleCreateEdge = () => {
    if (!edgeStartCamera || !edgeEndCamera) return;

    const from = direction === 'backward' ? edgeEndCamera.id : edgeStartCamera.id;
    const to = direction === 'backward' ? edgeStartCamera.id : edgeEndCamera.id;

    addTransition({
      fromCamera: from,
      toCamera: to,
      minTravelSec: parseInt(minTravelSec, 10) || 30,
      maxTravelSec: parseInt(maxTravelSec, 10) || 120,
      distanceMeters: calculatedDistanceMeters,
      isTwoWay: direction === 'two_way',
      source: 'manual',
    });

    onClearEdgeSelection();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleDeleteSelectedEdge = () => {
    if (!selectedEdge) return;
    deleteTransition(selectedEdge.fromCamera, selectedEdge.toCamera);
    onSelectEdge(null);
  };

  return (
    <div className="space-y-2">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-muted/90 backdrop-blur rounded-lg border border-border shadow-sm text-xs">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1 border-primary text-primary font-mono bg-primary/10">
            <Network className="h-3.5 w-3.5" />
            Topology Edit Mode (v{version})
          </Badge>
          <span className="text-muted-foreground hidden sm:inline">
            Click Camera A then Camera B to establish spatial pathways.
          </span>
        </div>

        <div className="flex items-center gap-2">
          {savedSuccess && (
            <span className="text-emerald-500 font-semibold flex items-center gap-1 text-[11px] animate-in fade-in">
              <CheckCircle2 className="h-3.5 w-3.5" /> Saved
            </span>
          )}

          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setShowVersionHistory(!showVersionHistory)}
          >
            <History className="h-3.5 w-3.5" />
            Version history
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs text-muted-foreground hover:text-foreground"
            onClick={onExitTopologyMode}
          >
            Discard
          </Button>

          <Button
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={onExitTopologyMode}
          >
            <Save className="h-3.5 w-3.5" />
            Done editing
          </Button>
        </div>
      </div>

      {/* Validation Warnings Alert Bar (if any) */}
      {warnings.length > 0 && (
        <div className="p-2.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-xs text-amber-500 space-y-1">
          <div className="flex items-center gap-1.5 font-semibold">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>Topology Validation Warnings ({warnings.length}):</span>
          </div>
          <ul className="list-disc list-inside text-[11px] space-y-0.5 text-foreground/90 pl-1">
            {warnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Version History Drawer (if open) */}
      {showVersionHistory && (
        <div className="p-3 rounded-lg border border-border bg-card space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground">Spatial Topology Change Audit</span>
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setShowVersionHistory(false)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="space-y-1.5 text-[11px]">
            <div className="p-1.5 rounded bg-muted/40 flex justify-between font-mono">
              <span>v{version} (Active Draft)</span>
              <span className="text-muted-foreground">{transitions.length} total edges</span>
            </div>
            <div className="p-1.5 rounded bg-muted/20 flex justify-between font-mono text-muted-foreground">
              <span>v{Math.max(1, version - 1)} (Previous)</span>
              <span>Committed by Insp. Sarah Vance</span>
            </div>
          </div>
        </div>
      )}

      {/* Active Edge Creation Card (when Camera A and Camera B selected) */}
      {edgeStartCamera && edgeEndCamera && (
        <div className="p-3 rounded-lg border border-primary/50 bg-card shadow-md space-y-3 text-xs animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-xs">
                {edgeStartCamera.cameraCode || edgeStartCamera.id}
              </Badge>
              <ArrowLeftRight className="h-4 w-4 text-primary" />
              <Badge variant="outline" className="font-mono text-xs">
                {edgeEndCamera.cameraCode || edgeEndCamera.id}
              </Badge>
              <span className="text-muted-foreground">
                ({calculatedDistanceMeters}m straight-line distance)
              </span>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClearEdgeSelection}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Directionality</Label>
              <Select value={direction} onValueChange={(v: any) => setDirection(v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="two_way">Two-way (A ↔ B)</SelectItem>
                  <SelectItem value="forward">One-way (A → B)</SelectItem>
                  <SelectItem value="backward">One-way (B → A)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Min Travel Time (s)</Label>
              <Input
                value={minTravelSec}
                onChange={(e) => setMinTravelSec(e.target.value)}
                className="h-8 font-mono text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Max Travel Time (s)</Label>
              <Input
                value={maxTravelSec}
                onChange={(e) => setMaxTravelSec(e.target.value)}
                className="h-8 font-mono text-xs"
              />
            </div>

            <div className="flex items-end gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1"
                onClick={handleSuggestFromDistance}
              >
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Suggest
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs flex-1"
                onClick={handleCreateEdge}
              >
                Create Edge
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Selected Edge Editor (when clicking an existing line) */}
      {selectedEdge && !edgeStartCamera && (
        <div className="p-3 rounded-lg border border-border bg-card shadow-md flex items-center justify-between text-xs animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 font-mono">
              <span className="font-bold">{selectedEdge.fromCamera}</span>
              <ArrowRight className="h-3.5 w-3.5 text-primary" />
              <span className="font-bold">{selectedEdge.toCamera}</span>
            </div>
            <span className="text-muted-foreground">
              Travel Window: <span className="font-mono text-foreground font-semibold">{selectedEdge.minTravelSec}s - {selectedEdge.maxTravelSec}s</span>
              {selectedEdge.distanceMeters && ` (${selectedEdge.distanceMeters}m)`}
            </span>
            <Badge variant="outline" className="text-[10px]">
              {selectedEdge.source === 'learned' ? 'Learned transition' : 'Manual transition'}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs text-rose-500 border-rose-500/30 gap-1"
              onClick={handleDeleteSelectedEdge}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete edge
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onSelectEdge(null)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
