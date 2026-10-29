'use client';

import React, { use, useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSearchJob } from '@/hooks/use-search-jobs';
import { useCases } from '@/hooks/use-cases';
import { useSightings, useDecideSighting } from '@/hooks/use-sightings';
import {
  SightingCard,
  EvidenceCompare,
  ScoreBreakdown,
  StatusChip,
  PriorityChip,
  EmptyState,
} from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Search,
  Pause,
  Play,
  XCircle,
  SlidersHorizontal,
  MapPin,
  Clock,
  Sparkles,
  CheckCircle2,
  GitFork,
  Eye,
  BookmarkPlus,
  ArrowRight,
  Filter,
  Layers,
  ChevronDown,
} from 'lucide-react';
import { SentinelMap, CameraLayer } from '@/components/features/map';
import { Sighting, Case } from '@/types';
import { cn } from '@/lib/utils';

export default function SearchResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const router = useRouter();
  const searchId = unwrappedParams.id;

  const { data: currentJob } = useSearchJob(searchId);
  const { data: cases = [] } = useCases();
  const { data: allSightings = [] } = useSightings();
  const decideMutation = useDecideSighting();

  const addCandidateToJourney = (_sighting: any) => {};
  const recordDecision = ({ sightingId, decision, reasonCode, notes }: any) => {
    decideMutation.mutate({
      id: sightingId,
      decision: decision === 'confirmed_sighting' ? 'confirmed' : 'rejected',
      reasonCode,
      note: notes,
    });
  };

  const targetCase = cases.find((c) => c.id === currentJob?.caseId) || cases[0];
  const references = useMemo(() => {
    return targetCase?.referencePhotos || [];
  }, [targetCase?.referencePhotos]);

  // Live progress simulation
  const [progress, setProgress] = useState(currentJob?.progressPercent || 35);
  const [isPaused, setIsPaused] = useState(false);
  const [activeTab, setActiveTab] = useState<'footage' | 'cases' | 'map' | 'log'>('footage');

  // Candidate selection & detail inspection sheet
  const [selectedCandidate, setSelectedCandidate] = useState<Sighting | null>(null);
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [groupBy, setGroupBy] = useState<'none' | 'camera' | 'track'>('none');
  const [minScoreFilter, setMinScoreFilter] = useState(60);

  // Simulate progress ticking up if running
  useEffect(() => {
    if (isPaused || progress >= 100) return;
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 5;
      });
    }, 1200);
    return () => clearInterval(interval);
  }, [isPaused, progress]);

  // Candidates for this search
  const candidates = useMemo(() => {
    return allSightings
      .filter((s) => s.fusedRank >= minScoreFilter / 100)
      .sort((a, b) => b.fusedRank - a.fusedRank);
  }, [allSightings, minScoreFilter]);

  // Bulk actions
  const handleToggleCheck = (id: string) => {
    setCheckedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const handleSelectAll = () => {
    if (checkedIds.length === candidates.length) setCheckedIds([]);
    else setCheckedIds(candidates.map((c) => c.id));
  };

  const handleSendToReview = () => {
    // Navigate to review with case filter
    router.push(`/review?case=${targetCase.id}`);
  };

  const handleAddToJourney = (sightingId: string) => {
    addCandidateToJourney(sightingId);
    router.push(`/journeys?case=${targetCase.id}`);
  };

  return (
    <div className="space-y-6 select-none">
      {/* 1. Header with Live Progress & Job Telemetry */}
      <div className="rounded-xl border bg-card p-4 space-y-3 shadow-xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground uppercase">AI Search Job</span>
              <span className="font-mono text-xs font-bold text-foreground">{searchId}</span>
              <Badge variant="outline" className="text-[10px] font-mono capitalize">
                {progress >= 100 ? 'Completed' : isPaused ? 'Paused' : 'Processing Video Shards'}
              </Badge>
            </div>
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              Surveillance Sweep: {targetCase?.personName}
            </h2>
          </div>

          {/* Job Control Actions */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsPaused(!isPaused)}
              className="h-8 text-xs gap-1.5"
            >
              {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
              {isPaused ? 'Resume' : 'Pause'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => router.push('/search')}
              className="h-8 text-xs gap-1.5"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Refine Query
            </Button>
          </div>
        </div>

        {/* Progress Bar & Telemetry Line */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
            <span>Progress: {progress}% (16/16 Shards Synced)</span>
            <span>Candidates Discovered: {candidates.length}</span>
            <span>ETA: {progress >= 100 ? '0s (Done)' : `${Math.round((100 - progress) * 0.8)}s`}</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </div>

      {/* 2. Main Tabs */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-full">
        <div className="flex items-center justify-between border-b pb-2">
          <TabsList className="h-8 bg-muted/60 p-0.5 border">
            <TabsTrigger value="footage" className="text-xs px-3 gap-1.5">
              Footage Candidates <span className="font-mono text-[10px]">({candidates.length})</span>
            </TabsTrigger>
            <TabsTrigger value="cases" className="text-xs px-3 gap-1.5">
              Matching Cases <span className="font-mono text-[10px]">(3)</span>
            </TabsTrigger>
            <TabsTrigger value="map" className="text-xs px-3 gap-1.5">
              Perimeter Map
            </TabsTrigger>
            <TabsTrigger value="log" className="text-xs px-3 gap-1.5">
              Search Log
            </TabsTrigger>
          </TabsList>

          {/* Bulk Action Controls */}
          {checkedIds.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-muted-foreground">
                {checkedIds.length} Selected
              </span>
              <Button size="sm" onClick={handleSendToReview} className="h-7 text-xs gap-1">
                <Eye className="h-3 w-3" />
                Send to Review
              </Button>
            </div>
          )}
        </div>

        {/* =========================================================================
            TAB 1: FOOTAGE CANDIDATES GRID
           ========================================================================= */}
        <TabsContent value="footage" className="mt-4 space-y-4">
          {/* Filter / Group Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                variant="outline"
                onClick={handleSelectAll}
                className="h-7 text-xs font-mono"
              >
                {checkedIds.length === candidates.length ? 'Deselect All' : 'Select All'}
              </Button>

              <div className="flex items-center gap-1.5 font-mono text-muted-foreground">
                <span>Min Score:</span>
                {[60, 75, 85].map((val) => (
                  <button
                    key={val}
                    onClick={() => setMinScoreFilter(val)}
                    className={cn(
                      'px-1.5 py-0.5 rounded text-[10px]',
                      minScoreFilter === val
                        ? 'bg-primary text-primary-foreground font-bold'
                        : 'hover:bg-muted',
                    )}
                  >
                    {val}%+
                  </button>
                ))}
              </div>
            </div>

            <span className="text-[11px] text-muted-foreground font-mono">
              Click any candidate card to inspect full comparison & score breakdown
            </span>
          </div>

          {/* Candidate Grid */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {candidates.map((cand) => (
              <SightingCard
                key={cand.id}
                sighting={cand}
                isSelected={selectedCandidate?.id === cand.id}
                isChecked={checkedIds.includes(cand.id)}
                onCheckChange={() => handleToggleCheck(cand.id)}
                onClick={() => setSelectedCandidate(cand)}
                isNew={cand.status === 'pending_review'}
              />
            ))}
          </div>
        </TabsContent>

        {/* =========================================================================
            TAB 2: MATCHING CASES (FOR PHOTO / CASE SEARCHES)
           ========================================================================= */}
        <TabsContent value="cases" className="mt-4 space-y-3">
          <div className="rounded-xl border bg-card divide-y">
            {cases.slice(0, 3).map((c, i) => (
              <div key={c.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src={c.referencePhotos?.[0]?.url}
                    alt={c.personName}
                    className="h-12 w-12 rounded-lg object-cover border"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{c.personName}</span>
                      <PriorityChip priority={c.priority} size="sm" />
                      <Badge variant="outline" className="font-mono text-[10px]">
                        Similarity: {94 - i * 8}%
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">
                      {c.caseNumber} • {c.lastSeenLocation}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => router.push(`/cases/${c.id}`)}
                    className="h-8 text-xs"
                  >
                    Open Dossier
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* =========================================================================
            TAB 3: MAP VIEW OF DISCOVERED HITS
           ========================================================================= */}
        <TabsContent value="map" className="mt-4">
          <div className="h-[480px] w-full rounded-xl border overflow-hidden relative">
            <SentinelMap center={[-73.98513, 40.758896]} zoom={14} className="h-full w-full">
              <CameraLayer cameras={cases as any} />
            </SentinelMap>
          </div>
        </TabsContent>

        {/* =========================================================================
            TAB 4: SEARCH LOG
           ========================================================================= */}
        <TabsContent value="log" className="mt-4">
          <div className="rounded-xl border bg-card p-4 font-mono text-xs space-y-2 bg-muted/20">
            <div className="text-muted-foreground">[00:00.12] Partitioning search jobs across 16 perimeter edge nodes</div>
            <div className="text-muted-foreground">[00:00.84] Normalizing reference vector ref_mc_01: 512-d L2 norm = 1.0</div>
            <div className="text-muted-foreground">[00:01.32] Querying Pinecone namespace 'cases-active' with Cosine metric</div>
            <div className="text-foreground">[00:02.10] Hit candidate sig_001 on CAM-01 (Score: 0.94) - Plausible transition</div>
            <div className="text-foreground">[00:02.85] Hit candidate sig_002 on CAM-02 (Score: 0.91) - Plausible transition</div>
          </div>
        </TabsContent>
      </Tabs>

      {/* 3. Slide-over Sheet for Selected Candidate Inspection */}
      <Sheet open={Boolean(selectedCandidate)} onOpenChange={() => setSelectedCandidate(null)}>
        <SheetContent side="right" className="sm:max-w-xl w-full p-6 overflow-y-auto space-y-5">
          <SheetHeader className="border-b pb-3">
            <SheetTitle className="text-base font-bold flex items-center justify-between">
              <span>Candidate Sighting Inspection</span>
              <Badge variant="outline" className="font-mono text-xs">
                Score: {selectedCandidate ? Math.round(selectedCandidate.fusedRank * 100) : 0}%
              </Badge>
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground">
              {selectedCandidate?.cameraName} • {selectedCandidate?.detectedAt}
            </SheetDescription>
          </SheetHeader>

          {selectedCandidate && (
            <div className="space-y-4">
              {/* Evidence Compare component */}
              <EvidenceCompare
                referencePhotos={references}
                activeReferenceUrl={references[0]?.url || selectedCandidate.referenceThumbnailUrl}
                candidateCropUrl={selectedCandidate.candidateFrameUrl}
                candidateFrameUrl={selectedCandidate.candidateFrameUrl}
                faceDetected={selectedCandidate.faceScore > 0}
                qualityScore={Math.round(selectedCandidate.fusedRank * 100)}
              />

              {/* Score Breakdown component */}
              <ScoreBreakdown
                scores={{
                  face: selectedCandidate.faceScore,
                  reid: selectedCandidate.reidScore,
                  temporal: selectedCandidate.temporalPlausibility,
                  cameraPlausibility: selectedCandidate.cameraPlausibility,
                  fused: selectedCandidate.fusedRank,
                }}
              />

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-2 border-t pt-4">
                <Button
                  onClick={() => {
                    handleAddToJourney(selectedCandidate.id);
                    setSelectedCandidate(null);
                  }}
                  className="flex-1 gap-1.5 bg-primary text-primary-foreground text-xs"
                >
                  <GitFork className="h-3.5 w-3.5" />
                  Add to Journey
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    router.push(`/review?case=${targetCase.id}&item=${selectedCandidate.id}`);
                    setSelectedCandidate(null);
                  }}
                  className="flex-1 gap-1.5 text-xs"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Review in Queue
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
