'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCases, useCaseOverview } from '@/hooks/use-cases';
import { useCreateSearchJob } from '@/hooks/use-search-jobs';
import { AI_MODEL_REGISTRY } from '@/lib/model-registry';
import {
  PersonCommand,
  ReadinessRing,
  PriorityChip,
  StatusChip,
} from '@/components/shared';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { SentinelMap, CameraLayer } from '@/components/features/map';
import {
  Search,
  Upload,
  Camera,
  Layers,
  MapPin,
  Clock,
  Sparkles,
  Info,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  Users,
  Grid3X3,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Case } from '@/types';

function SearchWorkspaceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: cases = [] } = useCases();
  const createJobMutation = useCreateSearchJob();

  // Search Mode: 'case' | 'photo' | 'multi'
  const modeParam = searchParams.get('mode') as 'case' | 'photo' | 'multi' | null;
  const [searchMode, setSearchMode] = useState<'case' | 'photo' | 'multi'>(modeParam || 'case');

  // Selected Case
  const caseParam = searchParams.get('case');
  const [selectedCaseId, setSelectedCaseId] = useState<string>(caseParam || cases[0]?.id || 'case_001');
  const selectedCase = cases.find((c) => c.id === selectedCaseId) || cases[0];
  const { data: caseOverview } = useCaseOverview(selectedCase?.id || '');
  const readinessScore = caseOverview?.readinessScore ?? 85;
  const readiness = { score: readinessScore };

  // Photo Search State
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [detectedFaces, setDetectedFaces] = useState<number>(0);
  const [selectedFaceBoxIndex, setSelectedFaceBoxIndex] = useState<number>(0);
  const [photoQuality, setPhotoQuality] = useState<{
    score: number;
    blur: string;
    size: string;
    pose: string;
    hints: string[];
  } | null>(null);

  // Photo Search Outputs
  const [outputCases, setOutputCases] = useState(true);
  const [outputFootage, setOutputFootage] = useState(true);

  // Soft Demographic Hints
  const [hintAge, setHintAge] = useState('');
  const [hintClothing, setHintClothing] = useState('');

  // Multi-angle slots (8 slots)
  const [poseSlots, setPoseSlots] = useState<Record<string, string | null>>({
    'front': 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=300&q=80',
    'front-left': null,
    'left': 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=300&q=80',
    'back-left': null,
    'back': null,
    'back-right': null,
    'right': null,
    'front-right': null,
  });

  // Parameters (Right column)
  const [timeWindow, setTimeWindow] = useState('12');
  const [minConfidence, setMinConfidence] = useState([70]);
  const [speedProfile, setSpeedProfile] = useState<'fast' | 'balanced' | 'thorough'>('balanced');
  const [spatialScope, setSpatialScope] = useState<'all' | 'reachable' | 'site' | 'radius'>('reachable');
  const [selectedSite, setSelectedSite] = useState('North Station Complex');

  // Camera calculations
  const cameraCount = spatialScope === 'reachable' ? 16 : spatialScope === 'site' ? 24 : 48;
  const estimatedDuration = speedProfile === 'fast' ? '45s' : speedProfile === 'balanced' ? '1m 20s' : '3m 15s';
  const expectedCandidates = Math.max(1, Math.round((100 - minConfidence[0]) * 0.15));

  // Sync mode changes with URL
  const handleModeChange = (mode: 'case' | 'photo' | 'multi') => {
    setSearchMode(mode);
    const p = new URLSearchParams(searchParams.toString());
    p.set('mode', mode);
    router.replace(`/search?${p.toString()}`);
  };

  // Mock Photo Upload & Analysis
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPhotoUrl(url);

    // Simulate SCRFD face detection & MagFace quality
    setTimeout(() => {
      setDetectedFaces(2); // Simulate multiple persons found
      setPhotoQuality({
        score: 84,
        blur: 'Low (Sharp)',
        size: '184px face crop',
        pose: 'Frontal (Yaw: 4°)',
        hints: ['High quality face detected', 'Slight shadow on left jaw - acceptable'],
      });
    }, 400);
  };

  // Trigger Search
  const handleStartSearch = () => {
    createJobMutation.mutate(
      {
        caseId: selectedCase?.id || 'case_001',
        caseTitle: selectedCase?.personName || 'Search Investigation',
        referencePhotoUrl:
          photoUrl ||
          selectedCase?.referencePhotos?.[0]?.url ||
          'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=300&q=80',
        status: 'extracting_features',
        progressPercent: 10,
        candidatesFound: 0,
        cameraScopeCount: cameraCount,
        timeRangeHours: parseInt(timeWindow, 10) || 12,
        minConfidence: minConfidence[0] / 100,
      },
      {
        onSuccess: (newJob) => {
          if (newJob?.id) {
            router.push(`/search/${newJob.id}`);
          }
        },
      },
    );
  };

  return (
    <div className="space-y-6 select-none">
      {/* 1. Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">AI Footage Search Workspace</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Query CCTV surveillance footage by active case dossier, uploaded photograph, or multi-angle vector set
          </p>
        </div>

        {/* Mode Segmented Control */}
        <div className="flex items-center border rounded-lg p-1 bg-muted/40 shadow-xs">
          <Button
            variant={searchMode === 'case' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => handleModeChange('case')}
            className="h-7 text-xs px-3"
          >
            From Case
          </Button>
          <Button
            variant={searchMode === 'photo' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => handleModeChange('photo')}
            className="h-7 text-xs px-3"
          >
            From Photo
          </Button>
          <Button
            variant={searchMode === 'multi' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => handleModeChange('multi')}
            className="h-7 text-xs px-3"
          >
            Multi-Angle Set
          </Button>
        </div>
      </div>

      {/* 2. Main 2-Column Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* =========================================================================
            LEFT COLUMN: QUERY BUILDER (8 COLS)
           ========================================================================= */}
        <div className="lg:col-span-8 space-y-6">
          {/* MODE 1: FROM CASE */}
          {searchMode === 'case' && (
            <Card className="rounded-xl border bg-card">
              <CardHeader className="border-b px-5 py-3.5 bg-muted/15">
                <CardTitle className="text-sm font-semibold">Select Target Case Dossier</CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Search Person / Case</Label>
                  <PersonCommand
                    isInlinePicker
                    selectedCaseId={selectedCaseId}
                    onSelectCase={(c) => setSelectedCaseId(c.id)}
                    className="w-full"
                  />
                </div>

                {selectedCase && (
                  <div className="rounded-xl border bg-secondary/15 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <img
                          src={selectedCase.referencePhotos?.[0]?.url}
                          alt={selectedCase.personName}
                          className="h-12 w-12 rounded-lg object-cover border"
                        />
                        <div>
                          <h4 className="font-bold text-sm text-foreground">{selectedCase.personName}</h4>
                          <span className="font-mono text-xs text-muted-foreground">
                            {selectedCase.caseNumber} • Last Seen: {selectedCase.lastSeenLocation}
                          </span>
                        </div>
                      </div>
                      <ReadinessRing score={readiness.score} size={36} />
                    </div>

                    <div className="border-t pt-2.5 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Reference set v{selectedCase.referenceSetVersion || 1} ({selectedCase.referencePhotos?.length || 0} photos)</span>
                      <span className="text-primary font-medium">Auto-populating reachable camera scope</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* MODE 2: FROM PHOTO (IMAGE SEARCH) */}
          {searchMode === 'photo' && (
            <Card className="rounded-xl border bg-card">
              <CardHeader className="border-b px-5 py-3.5 bg-muted/15">
                <CardTitle className="text-sm font-semibold">Image Upload & Biometric Extraction</CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-5">
                {/* Large Dropzone */}
                {!photoUrl ? (
                  <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center bg-muted/10 hover:bg-muted/20 transition-colors">
                    <Upload className="h-10 w-10 text-muted-foreground mb-3" />
                    <span className="text-sm font-semibold text-foreground">
                      Drag and drop target photo here, paste image, or click to upload
                    </span>
                    <span className="text-xs text-muted-foreground mt-1 max-w-sm">
                      Automatic person and face detection with SCRFD. Extracts 512-d ArcFace & OSNet embeddings.
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="mt-4 text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:bg-primary file:text-primary-foreground cursor-pointer"
                    />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row gap-4 items-start rounded-xl border bg-secondary/15 p-4">
                      {/* Uploaded Preview with Bounding Box Selection */}
                      <div className="relative aspect-square w-40 rounded-lg overflow-hidden border bg-black shrink-0">
                        <img src={photoUrl} alt="Uploaded" className="h-full w-full object-cover" />
                        {detectedFaces > 1 && (
                          <div className="absolute inset-0 flex flex-col justify-end p-2 bg-gradient-to-t from-black/80 to-transparent">
                            <span className="text-[10px] text-amber-400 font-mono font-bold">
                              {detectedFaces} People Detected
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Disambiguation & Quality Analysis */}
                      <div className="space-y-3 flex-1 min-w-0">
                        {detectedFaces > 1 && (
                          <div className="space-y-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
                            <span className="font-bold text-amber-600 dark:text-amber-400">
                              Who are you searching for? (Never guess)
                            </span>
                            <div className="flex items-center gap-2 pt-1">
                              <Button
                                size="sm"
                                variant={selectedFaceBoxIndex === 0 ? 'default' : 'outline'}
                                onClick={() => setSelectedFaceBoxIndex(0)}
                                className="h-7 text-xs"
                              >
                                Person 1 (Foreground Left)
                              </Button>
                              <Button
                                size="sm"
                                variant={selectedFaceBoxIndex === 1 ? 'default' : 'outline'}
                                onClick={() => setSelectedFaceBoxIndex(1)}
                                className="h-7 text-xs"
                              >
                                Person 2 (Center Right)
                              </Button>
                            </div>
                          </div>
                        )}

                        {photoQuality && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-foreground">
                                Biometric Quality Analysis
                              </span>
                              <Badge variant="outline" className="font-mono text-[10px]">
                                Quality: {photoQuality.score}%
                              </Badge>
                            </div>

                            <div className="grid grid-cols-3 gap-2 text-[11px] font-mono">
                              <div className="p-2 rounded border bg-background">
                                <span className="text-muted-foreground block text-[9px]">BLUR</span>
                                <span className="font-semibold">{photoQuality.blur}</span>
                              </div>
                              <div className="p-2 rounded border bg-background">
                                <span className="text-muted-foreground block text-[9px]">FACE SIZE</span>
                                <span className="font-semibold">{photoQuality.size}</span>
                              </div>
                              <div className="p-2 rounded border bg-background">
                                <span className="text-muted-foreground block text-[9px]">HEAD POSE</span>
                                <span className="font-semibold">{photoQuality.pose}</span>
                              </div>
                            </div>
                          </div>
                        )}

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPhotoUrl(null)}
                          className="h-7 text-xs text-muted-foreground"
                        >
                          Replace Photo
                        </Button>
                      </div>
                    </div>

                    {/* Output Scope Checkboxes */}
                    <div className="space-y-2 border-t pt-3">
                      <Label className="text-xs font-semibold">Search Outputs (Default: Both)</Label>
                      <div className="grid sm:grid-cols-2 gap-3">
                        <label className="flex items-center space-x-2.5 rounded-lg border p-3 cursor-pointer hover:bg-secondary/20">
                          <Checkbox checked={outputCases} onCheckedChange={(v) => setOutputCases(Boolean(v))} />
                          <div className="space-y-0.5">
                            <span className="text-xs font-medium text-foreground block">
                              Find Matching Cases in Database
                            </span>
                            <span className="text-[10px] text-muted-foreground block">
                              Rank existing missing persons by 512-d similarity
                            </span>
                          </div>
                        </label>

                        <label className="flex items-center space-x-2.5 rounded-lg border p-3 cursor-pointer hover:bg-secondary/20">
                          <Checkbox checked={outputFootage} onCheckedChange={(v) => setOutputFootage(Boolean(v))} />
                          <div className="space-y-0.5">
                            <span className="text-xs font-medium text-foreground block">
                              Search CCTV Surveillance Footage
                            </span>
                            <span className="text-[10px] text-muted-foreground block">
                              Sweep video nodes within chosen perimeter window
                            </span>
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* Soft Demographic Hints (Soft re-ranking only) */}
                    <div className="space-y-2 border-t pt-3">
                      <Label className="text-xs font-semibold text-foreground">
                        Optional Soft Hints (Re-ranking weights only, never hard filters)
                      </Label>
                      <div className="grid sm:grid-cols-2 gap-3">
                        <Input
                          placeholder="e.g. Approx age 14-16"
                          value={hintAge}
                          onChange={(e) => setHintAge(e.target.value)}
                          className="h-8 text-xs"
                        />
                        <Input
                          placeholder="e.g. Navy blue hoodie, teal backpack"
                          value={hintClothing}
                          onChange={(e) => setHintClothing(e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* MODE 3: MULTI-ANGLE SET (8 POSE SLOTS) */}
          {searchMode === 'multi' && (
            <Card className="rounded-xl border bg-card">
              <CardHeader className="border-b px-5 py-3.5 bg-muted/15 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">Multi-Angle Pose Matrix (8-Slot Coverage)</CardTitle>
                  <p className="text-[11px] text-muted-foreground">
                    Populate multiple camera angles to maximize 360-degree re-identification accuracy
                  </p>
                </div>
                <Badge variant="outline" className="font-mono text-xs">
                  Coverage: 3/8 Angles Active
                </Badge>
              </CardHeader>

              <CardContent className="p-5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {Object.entries(poseSlots).map(([slotKey, url]) => (
                    <div
                      key={slotKey}
                      className={cn(
                        'aspect-square rounded-xl border flex flex-col items-center justify-center p-2 relative overflow-hidden transition-all',
                        url ? 'bg-background border-primary/40' : 'bg-muted/10 border-dashed hover:bg-muted/20',
                      )}
                    >
                      {url ? (
                        <>
                          <img src={url} alt={slotKey} className="h-full w-full object-cover rounded-lg" />
                          <span className="absolute bottom-1 inset-x-1 text-center bg-background/80 text-[9px] font-mono uppercase truncate py-0.5 rounded">
                            {slotKey}
                          </span>
                        </>
                      ) : (
                        <div className="flex flex-col items-center text-center p-1">
                          <Camera className="h-5 w-5 text-muted-foreground mb-1" />
                          <span className="text-[10px] font-mono uppercase font-semibold text-muted-foreground">
                            {slotKey}
                          </span>
                          <span className="text-[9px] text-muted-foreground/60 mt-0.5">Click to add</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Spatial Scope Map Selection Card */}
          <Card className="rounded-xl border bg-card overflow-hidden">
            <CardHeader className="border-b px-5 py-3.5 bg-muted/15 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  Spatial Surveillance Perimeter ({cameraCount} Cameras Selected)
                </CardTitle>
                <p className="text-[11px] text-muted-foreground">
                  Choose geographical scope or walking reachable area polygon
                </p>
              </div>

              <div className="flex items-center gap-1 border rounded-md p-0.5 bg-background text-xs">
                {(['reachable', 'site', 'all'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setSpatialScope(mode)}
                    className={cn(
                      'px-2 py-1 text-[11px] font-mono capitalize rounded',
                      spatialScope === mode ? 'bg-secondary font-semibold text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </CardHeader>

            <div className="h-64 w-full relative">
              <SentinelMap center={[-73.98513, 40.758896]} zoom={14} className="h-full w-full">
                <CameraLayer cameras={cases.length > 0 ? (cases as any) : []} />
              </SentinelMap>
            </div>
          </Card>
        </div>

        {/* =========================================================================
            RIGHT COLUMN: STICKY SEARCH READINESS & SCOPE PARAMETERS (4 COLS)
           ========================================================================= */}
        <div className="lg:col-span-4 space-y-6 sticky top-20">
          {/* Readiness Summary Card */}
          <Card className="rounded-xl border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">Query Readiness</span>
              <ReadinessRing score={readiness.score} size={36} />
            </div>

            <p className="text-[11px] text-muted-foreground">
              {readiness.score >= 80
                ? 'Reference vectors and legal basis are high quality. Optimal for automated matching.'
                : 'Limited angle coverage may increase unverified false candidate volume.'}
            </p>

            <div className="rounded-lg border bg-secondary/15 p-2.5 space-y-1.5 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Camera Count:</span>
                <span className="font-bold text-foreground">{cameraCount} Nodes</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Est. Runtime:</span>
                <span className="font-bold text-foreground">~{estimatedDuration}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Expected Candidates:</span>
                <span className="font-bold text-foreground">~{expectedCandidates} hits</span>
              </div>
            </div>
          </Card>

          {/* Scope Parameters Card */}
          <Card className="rounded-xl border bg-card p-4 space-y-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider font-mono text-foreground">
              Search Parameters
            </h4>

            {/* Time Window Presets */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Time Window</Label>
              <div className="grid grid-cols-4 gap-1">
                {['2', '6', '12', '24'].map((hrs) => (
                  <Button
                    key={hrs}
                    size="sm"
                    variant={timeWindow === hrs ? 'secondary' : 'outline'}
                    onClick={() => setTimeWindow(hrs)}
                    className="h-7 text-xs font-mono"
                  >
                    {hrs}h
                  </Button>
                ))}
              </div>
            </div>

            {/* Minimum Candidate Threshold Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <Label className="text-xs font-medium">Min Candidate Confidence</Label>
                <span className="font-mono font-bold">{minConfidence[0]}%</span>
              </div>
              <Slider
                value={minConfidence}
                onValueChange={setMinConfidence}
                min={50}
                max={95}
                step={5}
              />
              <span className="text-[10px] text-muted-foreground block">
                Higher threshold reduces candidate volume; lower captures edge profile poses.
              </span>
            </div>

            {/* Search Speed Profile */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Search Speed & Depth</Label>
              <div className="grid grid-cols-3 gap-1">
                {(['fast', 'balanced', 'thorough'] as const).map((prof) => (
                  <Button
                    key={prof}
                    size="sm"
                    variant={speedProfile === prof ? 'secondary' : 'outline'}
                    onClick={() => setSpeedProfile(prof)}
                    className="h-7 text-xs font-mono capitalize"
                  >
                    {prof}
                  </Button>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* 3. Sticky Footer Action Bar */}
      <div className="sticky bottom-4 z-20 flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl border bg-background/95 backdrop-blur p-3.5 shadow-lg">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Info className="h-4 w-4 shrink-0 text-amber-500" />
          <span>Results are algorithmic possible sightings and require human reviewer verification.</span>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Button variant="outline" size="sm" className="h-9 text-xs">
            Save as Preset
          </Button>
          <Button
            size="sm"
            onClick={handleStartSearch}
            className="h-9 gap-2 shadow-sm bg-primary text-primary-foreground font-semibold px-4"
          >
            <Sparkles className="h-4 w-4" />
            Start AI Search ({cameraCount} Cameras)
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="p-8 text-xs text-muted-foreground">Loading Search Workspace...</div>}>
      <SearchWorkspaceContent />
    </Suspense>
  );
}
