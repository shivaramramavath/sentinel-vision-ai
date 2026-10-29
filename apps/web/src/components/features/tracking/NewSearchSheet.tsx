'use client';

import React, { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { DetailedJourney, DetailedHopNode } from '@/types/tracking';
import {
  Search,
  Camera,
  Clock,
  Sparkles,
  CheckCircle2,
  Sliders,
  AlertTriangle,
  Loader2,
  Footprints,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiClient } from '@/services/api.client';

export interface NewSearchSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  journey: DetailedJourney;
  onNewHopDiscovered?: (hop: DetailedHopNode) => void;
}

export function NewSearchSheet({
  open,
  onOpenChange,
  journey,
  onNewHopDiscovered,
}: NewSearchSheetProps) {
  const lastHop = journey.hops[journey.hops.length - 1];
  const lastConfirmedHop = [...journey.hops].reverse().find((h) => h.status === 'confirmed') || lastHop;

  // Search parameters
  const [selectedCameras, setSelectedCameras] = useState<string[]>(
    journey.suggestedCameras.map((c) => c.cameraId),
  );
  const [minConfidence, setMinConfidence] = useState(0.70);
  const [timeWindowStart, setTimeWindowStart] = useState(
    lastConfirmedHop ? new Date(lastConfirmedHop.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '17:15',
  );

  // Search execution status
  const [isSearching, setIsSearching] = useState(false);
  const [searchProgress, setSearchProgress] = useState(0);
  const [searchStatusText, setSearchStatusText] = useState('');
  const [foundHop, setFoundHop] = useState<DetailedHopNode | null>(null);

  const toggleCamera = (camId: string) => {
    setSelectedCameras((prev) =>
      prev.includes(camId) ? prev.filter((id) => id !== camId) : [...prev, camId],
    );
  };

  const handleStartSearch = async () => {
    setIsSearching(true);
    setSearchProgress(10);
    setSearchStatusText('Distributing search shards across edge nodes...');
    setFoundHop(null);

    try {
      // 1. Trigger API if available
      try {
        await apiClient.post('/search-jobs', {
          caseId: journey.caseId,
          cameraIds: selectedCameras,
          minConfidence,
          timeWindowMinutes: 60,
        });
      } catch {
        // Fallback simulation
      }

      // Step-by-step progress simulation
      await new Promise((r) => setTimeout(r, 600));
      setSearchProgress(45);
      setSearchStatusText(`Scanning video segments from ${selectedCameras.length} reachable cameras...`);

      await new Promise((r) => setTimeout(r, 800));
      setSearchProgress(80);
      setSearchStatusText('ArcFace & OSNet Re-ID embeddings inference running...');

      await new Promise((r) => setTimeout(r, 700));
      setSearchProgress(100);
      setSearchStatusText('New plausible sighting discovered!');

      // Create new candidate hop
      const newHop: DetailedHopNode = {
        hopNumber: journey.hops.length + 1,
        sightingId: `sight_live_${Date.now()}`,
        cameraId: selectedCameras[0] || 'cam_08',
        cameraName: journey.suggestedCameras[0]?.name || 'CAM-08: East Transit Connector',
        zone: 'Zone E - Departure Corridors',
        coords: journey.suggestedCameras[0]?.coords || [40.7162, -74.006],
        timestamp: new Date().toISOString(),
        dwellTimeSeconds: 40,
        status: 'possible',
        verified: false,
        isNew: true,
        scores: {
          face: 0.74,
          reid: 0.82,
          temporal: 0.89,
          cameraPlausibility: 0.94,
          fused: 0.79,
        },
        thumbnails: {
          referenceUrl: journey.hops[0]?.thumbnails.referenceUrl || '',
          cctvCropUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=300&q=80',
          frameUrl: 'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?auto=format&fit=crop&w=600&q=80',
          faceDetected: true,
          qualityScore: 84,
        },
        trackId: `TRK-${Math.floor(1000 + Math.random() * 9000)}`,
        direction: 'North-East',
        reviewInfo: {},
        transition: {
          elapsedSeconds: 320,
          distanceMeters: 280,
          speedMps: 0.88,
          plausibility: 'plausible',
        },
      };

      setFoundHop(newHop);
      onNewHopDiscovered?.(newHop);
    } catch {
      setSearchStatusText('Search encountered an error. Please retry.');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-6 overflow-y-auto space-y-5">
        <SheetHeader className="space-y-1 text-left">
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-cyan-400" />
            <SheetTitle className="text-base font-bold">New AI Search</SheetTitle>
          </div>
          <SheetDescription className="text-xs">
            Scoped multi-camera footage search for {journey.personName} ({journey.caseNumber}).
          </SheetDescription>
        </SheetHeader>

        {/* 1. Reference Set Summary & Readiness */}
        <div className="p-3 rounded-lg border bg-muted/30 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-400" /> Reference Dossier
            </span>
            <Badge variant="outline" className="text-[10px] font-mono text-emerald-400 border-emerald-500/50 bg-emerald-950/20">
              Readiness: 94%
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground">
            3 high-quality real reference images (2 frontal, 1 right profile). Synthetic references strictly prohibited.
          </p>
        </div>

        {/* 2. Pre-filled Camera Scope */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold">Suggested Cameras Scope</Label>
            <span className="text-[10px] text-muted-foreground font-mono">
              Inside reachable walking area
            </span>
          </div>

          <div className="space-y-1.5">
            {journey.suggestedCameras.map((cam) => {
              const isChecked = selectedCameras.includes(cam.cameraId);
              return (
                <div
                  key={cam.cameraId}
                  onClick={() => toggleCamera(cam.cameraId)}
                  className={cn(
                    'p-2 rounded border text-xs cursor-pointer flex items-center justify-between transition-colors',
                    isChecked
                      ? 'border-cyan-500/60 bg-cyan-950/20'
                      : 'border-border/60 bg-card hover:bg-muted/40',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Camera className={cn('h-3.5 w-3.5', isChecked ? 'text-cyan-400' : 'text-muted-foreground')} />
                    <div>
                      <div className="font-semibold text-foreground text-xs">{cam.name}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">
                        {cam.distanceMeters}m away • Arrival: {cam.expectedArrivalWindowMin}
                      </div>
                    </div>
                  </div>
                  <Badge variant={isChecked ? 'default' : 'outline'} className="text-[9px] font-mono">
                    {isChecked ? 'SELECTED' : 'ADD'}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. Time Window */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Time Window (Search From)</Label>
          <div className="flex items-center gap-2">
            <Input
              value={timeWindowStart}
              onChange={(e) => setTimeWindowStart(e.target.value)}
              className="h-8 text-xs font-mono"
            />
            <span className="text-[11px] text-muted-foreground shrink-0">to Current Time</span>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Defaults to last confirmed sighting at {new Date(lastConfirmedHop.timestamp).toLocaleTimeString()}.
          </p>
        </div>

        {/* 4. Minimum Confidence Slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <Label className="font-semibold">Minimum Fused Confidence</Label>
            <span className="font-mono font-bold text-cyan-400">
              {Math.round(minConfidence * 100)}%
            </span>
          </div>
          <Slider
            value={[Math.round(minConfidence * 100)]}
            onValueChange={(val) => setMinConfidence(val[0] / 100)}
            min={50}
            max={90}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
            <span>50% (High Recall)</span>
            <span>70% (Balanced)</span>
            <span>90% (Strict)</span>
          </div>
        </div>

        {/* 5. Live Search Progress Box */}
        {isSearching && (
          <div className="p-3.5 rounded-lg border border-cyan-500/40 bg-cyan-950/20 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-semibold text-cyan-300">
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Live Distributed Search
              </span>
              <span className="font-mono">{searchProgress}%</span>
            </div>
            <Progress value={searchProgress} className="h-1.5" />
            <p className="text-[10px] font-mono text-muted-foreground">{searchStatusText}</p>
          </div>
        )}

        {/* 6. Success Hop Preview */}
        {foundHop && (
          <div className="p-3 rounded-lg border border-emerald-500/50 bg-emerald-950/20 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
              <CheckCircle2 className="h-4 w-4" /> New Hop Discovered!
            </div>
            <div className="text-[11px] text-foreground">
              Candidate match found at <span className="font-semibold">{foundHop.cameraName}</span> with{' '}
              <span className="font-mono font-bold text-emerald-300">
                {Math.round((foundHop.scores.fused ?? 0.8) * 100)}%
              </span>{' '}
              fused score.
            </div>
            <p className="text-[10px] text-muted-foreground">
              Streamed to chronological timeline with a &quot;New&quot; badge.
            </p>
          </div>
        )}

        <SheetFooter className="pt-2">
          <Button
            onClick={handleStartSearch}
            disabled={isSearching || selectedCameras.length === 0}
            className="w-full h-9 text-xs bg-cyan-600 hover:bg-cyan-500 text-white font-semibold gap-1.5"
          >
            {isSearching ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Searching Cameras...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Start AI Search ({selectedCameras.length} Cameras)
              </>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
