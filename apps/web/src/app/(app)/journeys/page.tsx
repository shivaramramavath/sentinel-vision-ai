'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCases } from '@/hooks/use-cases';
import { useJourney } from '@/hooks/use-journeys';
import { useDecideSighting } from '@/hooks/use-sightings';
import {
  PersonCommand,
  CaseSwitcher,
  CaseHeader,
  ConfirmDialog,
  DecisionPayload,
  EmptyState,
} from '@/components/shared';
import {
  JourneyPlaybackBar,
  SelectedHopCard,
  JourneyTimeline,
  TrackingMap,
  EvidenceViewerModal,
  NewSearchSheet,
} from '@/components/features/tracking';
import { DetailedJourney, DetailedHopNode } from '@/types/tracking';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Footprints,
  Search,
  WifiOff,
  AlertTriangle,
  History,
  Sparkles,
  MapPin,
  Clock,
  Layers,
  ArrowRight,
  Shield,
  Film,
} from 'lucide-react';
import { cn } from '@/lib/utils';

function JourneysPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Active Case from URL or default
  const caseParam = searchParams.get('case') || 'case_001';
  const journeyParam = searchParams.get('journey') || 'A';
  const hopParam = searchParams.get('hop');

  // React Query hooks
  const { data: cases = [] } = useCases();
  const selectedCase = useMemo(() => {
    return cases.find((c) => c.id === caseParam || c.caseNumber === caseParam) || cases[0];
  }, [cases, caseParam]);

  const { data: loadedJourney } = useJourney(selectedCase?.id || '');
  const decideMutation = useDecideSighting();

  const caseJourneys = useMemo(() => {
    return loadedJourney ? [loadedJourney] : [];
  }, [loadedJourney]);

  const recordDecision = ({
    sightingId,
    decision,
    reasonCode,
    notes,
  }: any) => {
    const mappedDecision =
      decision === 'confirmed_sighting'
        ? ('confirmed' as const)
        : decision === 'rejected'
        ? ('rejected' as const)
        : ('possible' as const);

    decideMutation.mutate({
      id: sightingId,
      decision: mappedDecision,
      reasonCode,
      note: notes,
    });
  };

  const [selectedJourneyId, setSelectedJourneyId] = useState<string>(journeyParam);
  const activeJourney = useMemo(() => {
    return caseJourneys.find((j) => j.journeyId === selectedJourneyId) || caseJourneys[0];
  }, [caseJourneys, selectedJourneyId]);

  // Hop selection & hover state
  const initialHopIdx = hopParam ? parseInt(hopParam, 10) - 1 : 0;
  const [selectedHopIndex, setSelectedHopIndex] = useState(
    initialHopIdx >= 0 && initialHopIdx < (activeJourney?.hops?.length || 0) ? initialHopIdx : 0,
  );
  const [hoveredHopIndex, setHoveredHopIndex] = useState<number | null>(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0.0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  // Modals & Sheets
  const [isSearchSheetOpen, setIsSearchSheetOpen] = useState(false);
  const [evidenceHop, setEvidenceHop] = useState<DetailedHopNode | null>(null);
  const [isEvidenceModalOpen, setIsEvidenceModalOpen] = useState(false);

  // Confirm Decision Dialog
  const [decisionModalOpen, setDecisionModalOpen] = useState(false);
  const [pendingDecisionType, setPendingDecisionType] = useState<
    'confirmed_sighting' | 'rejected' | 'need_evidence'
  >('confirmed_sighting');
  const [decisionHop, setDecisionHop] = useState<DetailedHopNode | null>(null);

  // Update URL state
  const updateUrl = useCallback(
    (caseId: string, journeyId: string, hopIdx?: number) => {
      const p = new URLSearchParams(searchParams.toString());
      p.set('case', caseId);
      p.set('journey', journeyId);
      if (typeof hopIdx === 'number') {
        p.set('hop', String(hopIdx + 1));
      }
      router.replace(`/journeys?${p.toString()}`);
    },
    [router, searchParams],
  );

  // Switch Journey variant
  const handleSelectJourneyVariant = (jid: string) => {
    setSelectedJourneyId(jid);
    setSelectedHopIndex(0);
    setPlaybackProgress(0);
    setIsPlaying(false);
    updateUrl(selectedCase.id, jid, 0);
  };

  // Playback animation loop
  useEffect(() => {
    if (!isPlaying || !activeJourney || activeJourney.hops.length < 2) return;

    const animate = (timestamp: number) => {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = timestamp;
      }
      const delta = (timestamp - lastTimeRef.current) / 1000;
      lastTimeRef.current = timestamp;

      setPlaybackProgress((prev) => {
        const step = (delta * playbackSpeed) / (activeJourney.hops.length * 3);
        const next = prev + step;
        if (next >= 1.0) {
          setIsPlaying(false);
          lastTimeRef.current = null;
          return 1.0;
        }
        return next;
      });

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, playbackSpeed, activeJourney]);

  // Sync playback progress with selectedHopIndex
  useEffect(() => {
    if (!activeJourney || activeJourney.hops.length === 0) return;
    const computedIdx = Math.min(
      Math.floor(playbackProgress * activeJourney.hops.length),
      activeJourney.hops.length - 1,
    );
    setSelectedHopIndex((prev) => (prev === computedIdx ? prev : computedIdx));
  }, [playbackProgress, activeJourney]);

  // Selected Hop item
  const selectedHop = activeJourney?.hops?.[selectedHopIndex] || activeJourney?.hops?.[0];

  // Open Decision Dialog
  const handleTriggerDecision = (
    hop: DetailedHopNode,
    decisionType: 'confirmed_sighting' | 'rejected' | 'need_evidence',
  ) => {
    setDecisionHop(hop);
    setPendingDecisionType(decisionType);
    setDecisionModalOpen(true);
  };

  const handleConfirmDecision = (payload: DecisionPayload) => {
    if (!decisionHop) return;
    recordDecision({
      sightingId: decisionHop.sightingId,
      decision: payload.decision,
      reasonCode: payload.reasonCode,
      notes: payload.notes,
      checklist: payload.checklist,
      actor: 'Insp. Sarah Vance',
    });
  };

  if (!selectedCase) {
    return (
      <EmptyState
        title="No Case Selected"
        description="Choose a missing person to reconstruct multi-camera tracking journeys."
        actionLabel="View Cases"
        onAction={() => router.push('/cases')}
      />
    );
  }

  return (
    <div className="space-y-4 select-none pb-12">
      {/* 1. Header with Case Header & Search Action */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              Cross-Camera Tracking Journey
            </h1>
            <Badge variant="outline" className="text-xs font-mono">
              Trajectory Reconstruction
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Spatiotemporal kinematic verification across camera topology graph
          </p>
        </div>

        <div className="flex items-center gap-2">
          <CaseSwitcher />
          <Button
            size="sm"
            onClick={() => setIsSearchSheetOpen(true)}
            className="h-8 gap-1.5 bg-primary text-primary-foreground text-xs font-medium"
          >
            <Search className="h-3.5 w-3.5" />
            Search Footage Here
          </Button>
        </div>
      </div>

      {/* 2. Compact Person Header Strip with Key Telemetry */}
      <CaseHeader
        caseData={selectedCase}
        compact
        onRunSearch={() => setIsSearchSheetOpen(true)}
      />

      {/* 3. Main Grid (12-Columns Layout) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT (8 COLS): Map Card + Docked Playback Bar + Selected Hop Detail */}
        <div className="lg:col-span-8 space-y-4">
          <div className="relative rounded-xl border bg-card overflow-hidden shadow-xs">
            {/* Map Canvas */}
            {activeJourney && (
              <div className="h-[460px] w-full relative">
                <TrackingMap
                  journey={activeJourney as any}
                  selectedIndex={selectedHopIndex}
                  onSelectIndex={(idx: number) => {
                    setSelectedHopIndex(idx);
                    updateUrl(selectedCase.id, selectedJourneyId, idx);
                  }}
                  hoveredIndex={hoveredHopIndex}
                  onHoverIndex={setHoveredHopIndex}
                  playbackProgress={playbackProgress}
                />
              </div>
            )}

            {/* Docked Playback Bar */}
            {activeJourney && (
              <JourneyPlaybackBar
                journey={activeJourney as any}
                selectedIndex={selectedHopIndex}
                onSelectIndex={(idx: number) => {
                  setSelectedHopIndex(idx);
                  updateUrl(selectedCase.id, selectedJourneyId, idx);
                }}
                isPlaying={isPlaying}
                onTogglePlay={() => setIsPlaying(!isPlaying)}
                onReset={() => {
                  setPlaybackProgress(0);
                  setSelectedHopIndex(0);
                  setIsPlaying(true);
                }}
                playbackProgress={playbackProgress}
                onSeekProgress={(prog: number) => {
                  setPlaybackProgress(prog);
                  setIsPlaying(false);
                }}
                playbackSpeed={playbackSpeed}
                onChangeSpeed={setPlaybackSpeed}
              />
            )}
          </div>

          {/* Selected Hop Detail Card */}
          {selectedHop && (
            <SelectedHopCard
              hop={selectedHop as any}
              onOpenEvidenceModal={(hopNode: DetailedHopNode) => {
                setEvidenceHop(hopNode);
                setIsEvidenceModalOpen(true);
              }}
              onConfirm={() => handleTriggerDecision(selectedHop as any, 'confirmed_sighting')}
              onReject={() => handleTriggerDecision(selectedHop as any, 'rejected')}
            />
          )}
        </div>

        {/* RIGHT (4 COLS): Sticky Journey Timeline Card */}
        <div className="lg:col-span-4">
          <div className="rounded-xl border bg-card p-4 space-y-4 sticky top-18 shadow-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <span className="text-xs font-bold font-mono uppercase tracking-wider text-foreground">
                Chronological Hop Rail
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                {activeJourney?.hops?.length || 0} Hops
              </span>
            </div>

            {activeJourney && (
              <JourneyTimeline
                journeys={caseJourneys as any}
                selectedJourneyId={selectedJourneyId}
                onSelectJourneyId={handleSelectJourneyVariant}
                selectedHopIndex={selectedHopIndex}
                onSelectHopIndex={(idx: number) => {
                  setSelectedHopIndex(idx);
                  updateUrl(selectedCase.id, selectedJourneyId, idx);
                }}
                hoveredHopIndex={hoveredHopIndex}
                onHoverHopIndex={setHoveredHopIndex}
                onConfirmHop={(sightingId: string) => {
                  const targetHop = activeJourney.hops.find((h) => h.sightingId === sightingId) || selectedHop;
                  handleTriggerDecision(targetHop as any, 'confirmed_sighting');
                }}
                onRejectHop={(sightingId: string) => {
                  const targetHop = activeJourney.hops.find((h) => h.sightingId === sightingId) || selectedHop;
                  handleTriggerDecision(targetHop as any, 'rejected');
                }}
                onOpenEvidenceModal={(hop: DetailedHopNode) => {
                  setEvidenceHop(hop);
                  setIsEvidenceModalOpen(true);
                }}
                onOpenSearchSheet={() => setIsSearchSheetOpen(true)}
              />
            )}
          </div>
        </div>
      </div>

      {/* Decision Dialog */}
      <ConfirmDialog
        open={decisionModalOpen}
        onOpenChange={setDecisionModalOpen}
        decision={pendingDecisionType}
        candidateName={selectedCase.personName}
        cameraName={decisionHop?.cameraName || 'Surveillance Node'}
        isCritical={selectedCase.priority === 'critical'}
        onConfirm={handleConfirmDecision}
      />

      {/* Slide-over New Search Sheet */}
      {selectedCase && activeJourney && (
        <NewSearchSheet
          open={isSearchSheetOpen}
          onOpenChange={setIsSearchSheetOpen}
          journey={activeJourney as any}
          onNewHopDiscovered={() => {
            // New hop added
          }}
        />
      )}

      {/* Evidence Viewer Modal */}
      {evidenceHop && (
        <EvidenceViewerModal
          open={isEvidenceModalOpen}
          onOpenChange={setIsEvidenceModalOpen}
          hop={evidenceHop}
          onConfirm={() => handleTriggerDecision(evidenceHop, 'confirmed_sighting')}
          onReject={() => handleTriggerDecision(evidenceHop, 'rejected')}
        />
      )}
    </div>
  );
}

export default function JourneysPage() {
  return (
    <Suspense fallback={<div className="p-8 text-xs text-muted-foreground">Loading Journey Workspace...</div>}>
      <JourneysPageContent />
    </Suspense>
  );
}
