'use client';

import React, { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSightings, useDecideSighting } from '@/hooks/use-sightings';
import { useCases } from '@/hooks/use-cases';
import { useCounts } from '@/hooks/use-counts';
import {
  SightingCard,
  EvidenceCompare,
  ScoreBreakdown,
  StatusChip,
  PriorityChip,
  ConfirmDialog,
  DecisionPayload,
  EmptyState,
  KbdHint,
} from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Clock,
  Camera,
  Layers,
  GitFork,
  FileCheck2,
  Undo2,
  ShieldAlert,
  AlertTriangle,
  SidebarClose,
  SidebarOpen,
} from 'lucide-react';
import { SentinelMap, CameraLayer } from '@/components/features/map';
import { Sighting, ReferencePhoto } from '@/types';
import { cn } from '@/lib/utils';

function ReviewWorkspaceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // React Query Hooks
  const { data: allSightings = [] } = useSightings();
  const { data: cases = [] } = useCases();
  const { data: counts } = useCounts('global');
  const decideMutation = useDecideSighting();
  const allHardNegatives: any[] = [];
  const allAuditLogs: any[] = [];

  // Derived counts from selectors (primitive numbers)
  const pendingCount = counts?.pendingReview ?? allSightings.filter((s) => s.status === 'pending_review').length;
  const confirmedCount = allSightings.filter((s) => s.status === 'confirmed_sighting').length;
  const rejectedCount = allSightings.filter((s) => s.status === 'rejected').length;

  // URL Query Parameters
  const caseParam = searchParams.get('case');
  const statusParam = searchParams.get('status') || 'pending_review';
  const confParam = searchParams.get('conf') || 'all';
  const cameraParam = searchParams.get('camera') || 'all';
  const itemParam = searchParams.get('item');

  // Filter States
  const [selectedCaseId, setSelectedCaseId] = useState<string>(caseParam || 'all');
  const [selectedStatus, setSelectedStatus] = useState<string>(statusParam);
  const [selectedConf, setSelectedConf] = useState<string>(confParam);
  const [selectedCamera, setSelectedCamera] = useState<string>(cameraParam);

  // Right pane collapse toggle
  const [rightPaneOpen, setRightPaneOpen] = useState(true);

  // Undo Toast state
  const [lastUndoToken, setLastUndoToken] = useState<string | null>(null);
  const [undoMessage, setUndoMessage] = useState<string | null>(null);

  // Decision Modal state
  const [decisionModalOpen, setDecisionModalOpen] = useState(false);
  const [pendingDecisionType, setPendingDecisionType] = useState<
    'confirmed_sighting' | 'rejected' | 'need_evidence'
  >('confirmed_sighting');

  // Checklist for review
  const [checklist, setChecklist] = useState<string[]>([
    'Face features consistent with reference',
  ]);
  const [reviewerNotes, setReviewerNotes] = useState('');

  // Memoized Sighting Queue items
  const queueItems = useMemo(() => {
    return allSightings
      .filter((s) => {
        if (selectedCaseId !== 'all' && s.caseId !== selectedCaseId) return false;
        if (selectedStatus !== 'all' && s.status !== selectedStatus) return false;
        if (selectedConf !== 'all' && s.confidenceBand !== selectedConf) return false;
        if (selectedCamera !== 'all' && s.cameraId !== selectedCamera) return false;
        return true;
      })
      .sort((a, b) => b.fusedRank - a.fusedRank);
  }, [allSightings, selectedCaseId, selectedStatus, selectedConf, selectedCamera]);

  // Selected Sighting in Center Pane
  const [selectedSightingId, setSelectedSightingId] = useState<string>(itemParam || '');

  // Sync selected sighting if queue changes or initial load
  useEffect(() => {
    if (queueItems.length > 0) {
      if (!selectedSightingId || !queueItems.some((s) => s.id === selectedSightingId)) {
        setSelectedSightingId(queueItems[0].id);
      }
    }
  }, [queueItems, selectedSightingId]);

  const activeSighting = useMemo(() => {
    return queueItems.find((s) => s.id === selectedSightingId) || queueItems[0];
  }, [queueItems, selectedSightingId]);

  const targetCase = useMemo(() => {
    return cases.find((c) => c.id === activeSighting?.caseId);
  }, [cases, activeSighting?.caseId]);

  const references = useMemo(() => {
    return targetCase?.referencePhotos || [];
  }, [targetCase]);

  const hardNegatives = useMemo(() => {
    return allHardNegatives.filter((hn) => hn.caseId === targetCase?.id);
  }, [allHardNegatives, targetCase?.id]);

  const auditLogs = useMemo(() => {
    return allAuditLogs.filter((a) => !targetCase?.id || a.caseId === targetCase?.id);
  }, [allAuditLogs, targetCase?.id]);

  // Selected reference inside EvidenceCompare
  const [selectedRefPhoto, setSelectedRefPhoto] = useState<ReferencePhoto | null>(null);

  // Navigate next / previous
  const handleNextItem = useCallback(() => {
    const idx = queueItems.findIndex((s) => s.id === activeSighting?.id);
    if (idx !== -1 && idx < queueItems.length - 1) {
      setSelectedSightingId(queueItems[idx + 1].id);
    }
  }, [queueItems, activeSighting]);

  const handlePrevItem = useCallback(() => {
    const idx = queueItems.findIndex((s) => s.id === activeSighting?.id);
    if (idx > 0) {
      setSelectedSightingId(queueItems[idx - 1].id);
    }
  }, [queueItems, activeSighting]);

  // Execute Decision
  const handleExecuteDecision = (payload: DecisionPayload) => {
    if (!activeSighting) return;

    const mappedDecision =
      payload.decision === 'confirmed_sighting'
        ? ('confirmed' as const)
        : payload.decision === 'rejected'
        ? ('rejected' as const)
        : ('possible' as const);

    decideMutation.mutate({
      id: activeSighting.id,
      decision: mappedDecision,
      reasonCode: payload.reasonCode,
      note: payload.notes || reviewerNotes,
    });

    const actionLabel =
      payload.decision === 'confirmed_sighting'
        ? 'Marked as Same Person'
        : payload.decision === 'rejected'
        ? 'Rejected as Not Same Person'
        : 'Flagged Need Evidence';
    setUndoMessage(`${actionLabel} for ${activeSighting.personName}`);

    // Auto-advance
    handleNextItem();

    // Clear undo message after 10s
    setTimeout(() => {
      setUndoMessage(null);
      setLastUndoToken(null);
    }, 10_000);
  };

  const handleUndo = () => {
    setUndoMessage(null);
    setLastUndoToken(null);
  };

  // Open decision dialog
  const promptDecision = (type: 'confirmed_sighting' | 'rejected' | 'need_evidence') => {
    setPendingDecisionType(type);
    setDecisionModalOpen(true);
  };

  // Keyboard Shortcuts: C = Same, R = Not Same, N = Need Evidence, J = Next, K = Prev
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input/textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        promptDecision('confirmed_sighting');
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        promptDecision('rejected');
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        promptDecision('need_evidence');
      } else if (e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        handleNextItem();
      } else if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        handlePrevItem();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNextItem, handlePrevItem]);

  return (
    <div className="space-y-4 select-none">
      {/* 1. Header Toolbar with Filter Selector Counts */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Verification Review Workspace
            <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-500 text-xs font-mono">
              {pendingCount} Pending Review
            </Badge>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Human-in-the-loop surveillance candidate evaluation with multi-biometric alignment
          </p>
        </div>

        {/* Global Keyboard Navigation Hints */}
        <div className="hidden lg:flex items-center gap-2 text-xs text-muted-foreground font-mono">
          <span>Shortcuts:</span>
          <div className="flex items-center gap-1">
            <KbdHint>C</KbdHint> <span>Same</span>
          </div>
          <div className="flex items-center gap-1">
            <KbdHint>R</KbdHint> <span>Reject</span>
          </div>
          <div className="flex items-center gap-1">
            <KbdHint>N</KbdHint> <span>Need Info</span>
          </div>
          <div className="flex items-center gap-1">
            <KbdHint>J</KbdHint>/<KbdHint>K</KbdHint> <span>Next/Prev</span>
          </div>
        </div>
      </div>

      {/* 2. 10-Second Undo Banner (When active) */}
      {undoMessage && (
        <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-secondary/80 px-4 py-2 text-xs animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2 text-foreground font-medium">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <span>{undoMessage}</span>
          </div>
          <Button size="sm" variant="outline" onClick={handleUndo} className="h-7 text-xs gap-1 font-mono">
            <Undo2 className="h-3 w-3" />
            Undo (10s)
          </Button>
        </div>
      )}

      {/* 3. Three-Pane Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start min-h-[640px]">
        {/* =========================================================================
            PANE 1: LEFT QUEUE (340px / 3 cols)
           ========================================================================= */}
        <div className="lg:col-span-3 space-y-3">
          {/* Queue Filters */}
          <div className="rounded-xl border bg-card p-3 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-foreground uppercase tracking-wider font-mono text-[10px]">
                Queue Filters
              </span>
              <span className="font-mono text-muted-foreground text-[10px]">{queueItems.length} Sightings</span>
            </div>

            {/* Case Filter */}
            <Select value={selectedCaseId} onValueChange={setSelectedCaseId}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="All Cases" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cases ({cases.length})</SelectItem>
                {cases.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.personName} ({c.caseNumber})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="h-8 text-xs font-mono">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending_review">Pending Review ({pendingCount})</SelectItem>
                <SelectItem value="confirmed_sighting">Confirmed by Reviewer ({confirmedCount})</SelectItem>
                <SelectItem value="rejected">Rejected ({rejectedCount})</SelectItem>
                <SelectItem value="need_evidence">Need More Evidence</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Sighting Queue List */}
          <div className="space-y-2 max-h-[calc(100vh-16rem)] overflow-y-auto pr-1">
            {queueItems.length === 0 ? (
              <EmptyState
                title="Queue Caught Up"
                description="No sightings match the current filter criteria."
              />
            ) : (
              queueItems.map((item) => (
                <SightingCard
                  key={item.id}
                  sighting={item}
                  isSelected={activeSighting?.id === item.id}
                  onClick={() => setSelectedSightingId(item.id)}
                  isNew={item.status === 'pending_review'}
                  compact
                />
              ))
            )}
          </div>
        </div>

        {/* =========================================================================
            PANE 2: CENTER DECISION WORKSPACE (6 or 9 cols)
           ========================================================================= */}
        <div className={cn(rightPaneOpen ? 'lg:col-span-6' : 'lg:col-span-9', 'space-y-4')}>
          {activeSighting ? (
            <div className="space-y-4">
              {/* Sighting Header Strip */}
              <div className="flex flex-wrap items-center justify-between rounded-xl border bg-card p-3.5 gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold font-mono text-muted-foreground uppercase">
                      Possible Match:
                    </span>
                    <h2 className="text-base font-bold text-foreground">{activeSighting.personName}</h2>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {activeSighting.caseNumber}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                    <Camera className="h-3 w-3" />
                    <span>{activeSighting.cameraName}</span>
                    <span>•</span>
                    <Clock className="h-3 w-3" />
                    <span>{new Date(activeSighting.detectedAt).toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <StatusChip status={activeSighting.status} />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setRightPaneOpen(!rightPaneOpen)}
                    className="h-8 w-8 text-muted-foreground hover:text-foreground hidden lg:flex"
                    title={rightPaneOpen ? 'Collapse context pane' : 'Expand context pane'}
                  >
                    {rightPaneOpen ? <SidebarClose className="h-4 w-4" /> : <SidebarOpen className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {/* Large Evidence Compare Viewport */}
              <EvidenceCompare
                referencePhotos={references}
                activeReferenceUrl={selectedRefPhoto?.url || activeSighting.referenceThumbnailUrl}
                onSelectReference={(ref) => setSelectedRefPhoto(ref)}
                candidateCropUrl={activeSighting.candidateFrameUrl}
                candidateFrameUrl={activeSighting.candidateFrameUrl}
                faceDetected={activeSighting.faceScore > 0}
                qualityScore={Math.round(activeSighting.fusedRank * 100)}
              />

              {/* Score Breakdown with Calibration & Config facts */}
              <ScoreBreakdown
                scores={{
                  face: activeSighting.faceScore,
                  reid: activeSighting.reidScore,
                  temporal: activeSighting.temporalPlausibility,
                  cameraPlausibility: activeSighting.cameraPlausibility,
                  fused: activeSighting.fusedRank,
                }}
                historicalPrecisionBand="Candidates in this score band (85-95%) were confirmed 64% of the time in past reviews"
              />

              {/* STICKY DECISION BAR AT BOTTOM */}
              <div className="sticky bottom-2 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background/95 backdrop-blur p-3.5 shadow-lg">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrevItem}
                    className="h-9 px-2 text-xs"
                    title="Previous sighting (K)"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNextItem}
                    className="h-9 px-2 text-xs"
                    title="Next sighting (J)"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                {/* Primary black/white Same Person, Outline for Not Same & Need Evidence */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => promptDecision('rejected')}
                    className="h-9 text-xs gap-1.5"
                  >
                    <XCircle className="h-4 w-4 text-muted-foreground" />
                    Not The Same Person
                    <KbdHint className="ml-1">R</KbdHint>
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => promptDecision('need_evidence')}
                    className="h-9 text-xs gap-1.5"
                  >
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                    Need More Evidence
                    <KbdHint className="ml-1">N</KbdHint>
                  </Button>

                  <Button
                    variant="default"
                    onClick={() => promptDecision('confirmed_sighting')}
                    className="h-9 gap-1.5 bg-primary text-primary-foreground font-semibold px-4 shadow-sm"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Same Person
                    <KbdHint className="ml-1 bg-primary-foreground/20 text-primary-foreground">C</KbdHint>
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              title="All Caught Up"
              description="No sightings pending review in this queue. Great job maintaining zero backlog."
              actionLabel="Return to Cases"
              onAction={() => router.push('/cases')}
            />
          )}
        </div>

        {/* =========================================================================
            PANE 3: RIGHT CONTEXT (320px / 3 cols, collapsible)
           ========================================================================= */}
        {rightPaneOpen && activeSighting && (
          <div className="lg:col-span-3 space-y-4">
            {/* Journey Context Card */}
            <Card className="rounded-xl border bg-card p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider font-mono text-foreground">
                  Where This Fits in Journey
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => router.push(`/journeys?case=${activeSighting.caseId}`)}
                  className="h-6 text-[11px] px-1.5 gap-1 text-primary"
                >
                  <GitFork className="h-3 w-3" />
                  Open Journey
                </Button>
              </div>

              <div className="h-36 w-full rounded-lg border overflow-hidden relative">
                <SentinelMap center={[-73.98513, 40.758896]} zoom={15} className="h-full w-full">
                  <CameraLayer cameras={cases as any} />
                </SentinelMap>
              </div>

              <div className="rounded-lg border bg-secondary/15 p-2.5 space-y-1 text-xs">
                <div className="flex justify-between font-mono text-[11px]">
                  <span className="text-muted-foreground">Transition:</span>
                  <span className="font-semibold text-foreground">Plausible (4m 21s)</span>
                </div>
                <div className="flex justify-between font-mono text-[11px]">
                  <span className="text-muted-foreground">Walking Speed:</span>
                  <span className="font-semibold text-foreground">1.02 m/s</span>
                </div>
              </div>
            </Card>

            {/* Hard Negatives Card */}
            <Card className="rounded-xl border bg-card p-3.5 space-y-2.5">
              <span className="text-xs font-semibold uppercase tracking-wider font-mono text-foreground block">
                Hard Negatives ({hardNegatives.length})
              </span>
              <p className="text-[10px] text-muted-foreground">
                Previously rejected crops from this case used to suppress similar false matches.
              </p>
              {hardNegatives.length > 0 ? (
                <div className="grid grid-cols-3 gap-1.5">
                  {hardNegatives.map((hn: any) => (
                    <div key={hn.id} className="aspect-square rounded border overflow-hidden relative" title={hn.reasonCode}>
                      <img src={hn.cropUrl} alt="Hard Negative" className="h-full w-full object-cover" />
                      <span className="absolute bottom-0 inset-x-0 bg-background/80 text-[7px] font-mono text-center truncate">
                        {hn.reasonCode}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-muted-foreground italic">No rejected crops recorded yet.</span>
              )}
            </Card>

            {/* Recent Audit Snippet */}
            <Card className="rounded-xl border bg-card p-3.5 space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider font-mono text-foreground block">
                Case Decision Audit Log
              </span>
              <div className="space-y-2 text-xs">
                {auditLogs.slice(0, 3).map((log: any) => (
                  <div key={log.id} className="border-l-2 pl-2 py-0.5 space-y-0.5 border-primary/40">
                    <p className="text-[10px] font-mono font-medium text-foreground">{log.action}</p>
                    <p className="text-[10px] text-muted-foreground line-clamp-1">{log.details}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Confirmation / Reason Code Dialog */}
      <ConfirmDialog
        open={decisionModalOpen}
        onOpenChange={setDecisionModalOpen}
        decision={pendingDecisionType}
        candidateName={activeSighting?.personName || 'Candidate'}
        cameraName={activeSighting?.cameraName || 'Surveillance Node'}
        isCritical={targetCase?.priority === 'critical'}
        onConfirm={handleExecuteDecision}
      />
    </div>
  );
}

export default function ReviewPage() {
  return (
    <Suspense fallback={<div className="p-8 text-xs text-muted-foreground">Loading Review Workspace...</div>}>
      <ReviewWorkspaceContent />
    </Suspense>
  );
}
