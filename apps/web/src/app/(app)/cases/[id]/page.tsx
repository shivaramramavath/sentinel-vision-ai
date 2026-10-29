'use client';

import React, { use, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCases, useCaseOverview } from '@/hooks/use-cases';
import { useSightings } from '@/hooks/use-sightings';
import { useSearchJobs } from '@/hooks/use-search-jobs';
import { useCounts } from '@/hooks/use-counts';
import {
  CaseHeader,
  StatusChip,
  PriorityChip,
  ReadinessRing,
  EmptyState,
  SightingCard,
} from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  MapPin,
  Clock,
  Shirt,
  UserCheck,
  Search,
  Eye,
  GitFork,
  FileCheck2,
  FileText,
  AlertCircle,
  Sparkles,
  Camera,
  Layers,
  ArrowRight,
  ExternalLink,
  Upload,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { SentinelMap, LastKnownLayer } from '@/components/features/map';
import { cn } from '@/lib/utils';

export default function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();

  const caseId = unwrappedParams.id;
  const { data: cases = [] } = useCases();
  const { data: allSightings = [] } = useSightings();
  const { data: allSearches = [] } = useSearchJobs(caseId);
  const { data: caseOverview } = useCaseOverview(caseId);
  const { data: counts } = useCounts(`case:${caseId}`);

  const caseItem = useMemo(() => {
    return cases.find((c) => c.id === caseId || c.caseNumber === caseId) || cases[0];
  }, [cases, caseId]);

  const sightings = useMemo(() => {
    return allSightings.filter((s) => s.caseId === caseItem?.id);
  }, [allSightings, caseItem?.id]);

  const searches = useMemo(() => {
    return allSearches.filter((s) => s.caseId === caseItem?.id);
  }, [allSearches, caseItem?.id]);

  const references = useMemo(() => {
    return caseItem?.referencePhotos || [];
  }, [caseItem?.referencePhotos]);

  const auditLogs = useMemo<Array<{ id: string; action: string; actor: string; details: string; timestamp: string }>>(() => {
    return [];
  }, []);

  const score = caseOverview?.readinessScore ?? 85;
  const readiness = useMemo(() => {
    return {
      score,
      tier: score >= 80 ? 'READY' : score >= 60 ? 'SUBOPTIMAL' : 'INSUFFICIENT',
      recommendations: score < 80 ? ['Upload additional high-resolution frontal reference photograph'] : [],
    };
  }, [score]);

  const pendingCount = counts?.pendingReviews ?? counts?.pendingReview ?? 0;

  // Active Tab from URL query or state
  const tabFromUrl = searchParams.get('tab') || 'overview';
  const [activeTab, setActiveTab] = useState(tabFromUrl);

  const handleTabChange = (val: string) => {
    setActiveTab(val);
    const p = new URLSearchParams(searchParams.toString());
    p.set('tab', val);
    router.replace(`/cases/${caseItem.id}?${p.toString()}`);
  };

  if (!caseItem) {
    return (
      <EmptyState
        title="Case Not Found"
        description="The requested missing person case could not be located in the database."
        actionLabel="Back to Cases"
        onAction={() => router.push('/cases')}
      />
    );
  }

  const primaryPhoto =
    references[0]?.url ||
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80';

  return (
    <div className="space-y-6 select-none">
      {/* 1. Universal Case Header */}
      <CaseHeader
        caseData={caseItem}
        onRunSearch={() => router.push(`/search?mode=case&case=${caseItem.id}`)}
      />

      {/* 2. Top Tab Navigation Strip */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="h-10 bg-muted/60 p-1 w-full justify-start overflow-x-auto border">
          <TabsTrigger value="overview" className="text-xs px-3 gap-1.5">
            Overview
          </TabsTrigger>
          <TabsTrigger value="references" className="text-xs px-3 gap-1.5">
            References <span className="font-mono text-[10px] opacity-70">({references.length})</span>
          </TabsTrigger>
          <TabsTrigger value="searches" className="text-xs px-3 gap-1.5">
            Searches <span className="font-mono text-[10px] opacity-70">({searches.length})</span>
          </TabsTrigger>
          <TabsTrigger value="review" className="text-xs px-3 gap-1.5">
            Review <span className="font-mono text-[10px] font-bold text-amber-500">({pendingCount})</span>
          </TabsTrigger>
          <TabsTrigger value="journey" className="text-xs px-3 gap-1.5">
            Tracking Journey
          </TabsTrigger>
          <TabsTrigger value="evidence" className="text-xs px-3 gap-1.5">
            Evidence <span className="font-mono text-[10px] opacity-70">({sightings.length})</span>
          </TabsTrigger>
          <TabsTrigger value="activity" className="text-xs px-3 gap-1.5">
            Audit Activity <span className="font-mono text-[10px] opacity-70">({auditLogs.length})</span>
          </TabsTrigger>
          <TabsTrigger value="reports" className="text-xs px-3 gap-1.5">
            Reports
          </TabsTrigger>
        </TabsList>

        {/* =========================================================================
            TAB 1: OVERVIEW (12-COLUMN LAYOUT)
           ========================================================================= */}
        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* LEFT 8 COLUMNS: Profile, Circumstances, Reachable Area Map */}
            <div className="lg:col-span-8 space-y-6">
              {/* Profile & Circumstances Card */}
              <Card className="rounded-xl border bg-card">
                <CardHeader className="border-b px-5 py-3.5 bg-muted/15 flex flex-row items-center justify-between">
                  <div className="space-y-0.5">
                    <CardTitle className="text-sm font-semibold">Circumstances & Physical Profile</CardTitle>
                    <p className="text-[11px] text-muted-foreground">
                      Investigator notes, last observed clothing, and distinguishing features
                    </p>
                  </div>
                  <Button variant="outline" size="sm" className="h-7 text-xs">
                    Edit Details
                  </Button>
                </CardHeader>

                <CardContent className="p-5 space-y-4">
                  {/* Definition Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 rounded-lg border bg-secondary/15 p-3.5 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-mono text-muted-foreground">Approx Age</span>
                      <p className="font-semibold text-foreground mt-0.5">{caseItem.age} years old</p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-mono text-muted-foreground">Gender</span>
                      <p className="font-semibold text-foreground mt-0.5 capitalize">{caseItem.gender}</p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-mono text-muted-foreground">Height</span>
                      <p className="font-semibold text-foreground mt-0.5">{caseItem.heightCm || 160} cm</p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-mono text-muted-foreground">Report FIR #</span>
                      <p className="font-mono font-semibold text-foreground mt-0.5">
                        {caseItem.registrationAuth?.authority?.firOrCaseNumber || 'FIR-2026-9904'}
                      </p>
                    </div>
                  </div>

                  {/* Incident Description */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-semibold text-foreground">Incident Summary</span>
                    <p className="text-xs text-muted-foreground leading-relaxed bg-muted/20 p-3 rounded-lg border">
                      {caseItem.description}
                    </p>
                  </div>

                  {/* Clothing & Attire Chips */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Shirt className="h-3.5 w-3.5" />
                      Attire & Carried Items
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {caseItem.lastSeenWearing.split(',').map((item, i) => (
                        <Badge key={i} variant="secondary" className="text-xs py-1 px-2.5 font-normal">
                          {item.trim()}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Distinguishing Marks */}
                  {caseItem.distinguishingFeatures && (
                    <div className="space-y-1.5">
                      <span className="text-xs font-semibold text-foreground">Distinguishing Features</span>
                      <p className="text-xs text-muted-foreground bg-muted/20 p-2.5 rounded-lg border">
                        {caseItem.distinguishingFeatures}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Map: Last Known Location & Reachable Perimeter */}
              <Card className="rounded-xl border bg-card overflow-hidden">
                <CardHeader className="border-b px-5 py-3.5 bg-muted/15 flex flex-row items-center justify-between">
                  <div className="space-y-0.5">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" />
                      Last Known Location & Estimated Reachable Area
                    </CardTitle>
                    <p className="text-[11px] text-muted-foreground">
                      Walking speed model ({readiness.score > 70 ? '1.2 m/s' : '0.9 m/s'}) with suggested perimeter cameras
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => router.push(`/journeys?case=${caseItem.id}`)}
                    className="h-7 text-xs gap-1"
                  >
                    Open Live Tracking
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </CardHeader>
                <div className="h-72 w-full relative">
                  <SentinelMap center={[-73.98513, 40.758896]} zoom={14.5} className="h-full w-full">
                    <LastKnownLayer
                      center={[-73.98513, 40.758896]}
                      lastSeenTimestamp={caseItem.lastSeenAt}
                      locationName={caseItem.lastSeenLocation}
                    />
                  </SentinelMap>
                </div>
              </Card>
            </div>

            {/* RIGHT 4 COLUMNS: Primary Reference, Readiness, Attention, Activity */}
            <div className="lg:col-span-4 space-y-6">
              {/* Primary Reference & Angle Coverage */}
              <Card className="rounded-xl border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">Primary Reference Photo</span>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    Quality: 94%
                  </Badge>
                </div>

                <div className="aspect-square w-full rounded-lg overflow-hidden border bg-muted relative">
                  <img src={primaryPhoto} alt="Primary Ref" className="h-full w-full object-cover" />
                  <div className="absolute bottom-2 left-2 right-2 rounded bg-background/85 backdrop-blur px-2.5 py-1 text-[11px] font-mono flex items-center justify-between">
                    <span>Frontal Face</span>
                    <span className="text-primary font-bold">512-d Vector Active</span>
                  </div>
                </div>

                {/* Mini Gallery Strip */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-mono uppercase text-muted-foreground">
                    Reference Gallery ({references.length} Angles)
                  </span>
                  <div className="grid grid-cols-4 gap-2">
                    {references.map((ref, idx) => (
                      <div
                        key={ref.id || idx}
                        className="aspect-square rounded border overflow-hidden relative group cursor-pointer"
                        title={ref.type}
                      >
                        <img src={ref.url} alt={`Ref ${idx}`} className="h-full w-full object-cover" />
                        <span className="absolute bottom-0 inset-x-0 bg-background/80 text-[8px] font-mono text-center truncate">
                          {ref.type}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>

              {/* Search Readiness Gauge & Actionable Recommendations */}
              <Card className="rounded-xl border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">Search Readiness Index</span>
                  <ReadinessRing score={readiness.score} size={36} />
                </div>

                <p className="text-[11px] text-muted-foreground">
                  Measures biometric coverage and authorization integrity for automated footage matching.
                </p>

                {readiness.recommendations.length > 0 && (
                  <div className="space-y-2 border-t pt-2">
                    <span className="text-[11px] font-semibold text-foreground">Recommended Actions:</span>
                    <ul className="space-y-1.5 text-xs text-muted-foreground">
                      {readiness.recommendations.map((rec, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>

              {/* Needs Your Attention List */}
              <Card className="rounded-xl border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">Needs Attention</span>
                  {pendingCount > 0 && (
                    <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-500 text-[10px]">
                      {pendingCount} Pending
                    </Badge>
                  )}
                </div>

                <div className="space-y-2 text-xs">
                  {pendingCount > 0 ? (
                    <div
                      onClick={() => handleTabChange('review')}
                      className="flex items-center justify-between p-2.5 rounded-lg border bg-secondary/30 hover:bg-secondary/50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Eye className="h-4 w-4 text-amber-500" />
                        <div>
                          <p className="font-semibold text-foreground">{pendingCount} Unreviewed Sightings</p>
                          <p className="text-[10px] text-muted-foreground">Possible matches require human confirmation</p>
                        </div>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-muted-foreground text-xs p-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      <span>All sightings reviewed for this case</span>
                    </div>
                  )}

                  <div
                    onClick={() => router.push(`/search?mode=case&case=${caseItem.id}`)}
                    className="flex items-center justify-between p-2.5 rounded-lg border bg-secondary/30 hover:bg-secondary/50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Search className="h-4 w-4 text-primary" />
                      <div>
                        <p className="font-semibold text-foreground">Launch Automated AI Sweep</p>
                        <p className="text-[10px] text-muted-foreground">Scan 16 cameras within reachable perimeter</p>
                      </div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </div>
              </Card>

              {/* Recent Activity Timeline */}
              <Card className="rounded-xl border bg-card p-4 space-y-3">
                <span className="text-xs font-semibold text-foreground">Recent Audit Trail</span>
                <div className="space-y-2.5 text-xs">
                  {auditLogs.slice(0, 4).map((log) => (
                    <div key={log.id} className="border-l-2 pl-2.5 py-0.5 space-y-0.5 border-primary/40">
                      <p className="font-medium text-foreground text-[11px]">{log.action}</p>
                      <p className="text-[10px] text-muted-foreground">{log.details}</p>
                      <span className="text-[9px] font-mono text-muted-foreground/80">
                        {log.actor} • {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* =========================================================================
            TAB 2: REFERENCES (UPLOAD & POSE COVERAGE MANAGER)
           ========================================================================= */}
        <TabsContent value="references" className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Reference Set Manager (v{caseItem.referenceSetVersion || 1})</h3>
              <p className="text-xs text-muted-foreground">
                Real photos only. Never synthesize or fabricate faces with generative models.
              </p>
            </div>
            <Button size="sm" className="gap-1.5 text-xs">
              <Upload className="h-3.5 w-3.5" />
              Upload New Angle Reference
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {references.map((ref, idx) => (
              <Card key={ref.id || idx} className="overflow-hidden border rounded-xl">
                <div className="aspect-video w-full bg-muted relative">
                  <img src={ref.url} alt={ref.type} className="h-full w-full object-cover" />
                  <div className="absolute top-2 left-2">
                    <Badge variant="secondary" className="text-[10px] font-mono">
                      {ref.type}
                    </Badge>
                  </div>
                  <div className="absolute top-2 right-2">
                    <Badge variant="outline" className="text-[10px] font-mono bg-background/80">
                      Quality: {ref.qualityScore}%
                    </Badge>
                  </div>
                </div>
                <div className="p-3 space-y-2 text-xs">
                  <div className="flex justify-between text-muted-foreground font-mono text-[10px]">
                    <span>Uploaded: {new Date(ref.uploadedAt).toLocaleDateString()}</span>
                    <span>512-d ArcFace</span>
                  </div>
                  <div className="flex justify-end gap-1.5 pt-1">
                    <Button size="sm" variant="outline" className="h-7 text-xs">
                      Set Primary
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-rose-500">
                      Remove
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* =========================================================================
            TAB 3: SEARCHES (AI JOBS TABLE)
           ========================================================================= */}
        <TabsContent value="searches" className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Search Jobs & Video Vector Sweeps</h3>
            <Button
              size="sm"
              onClick={() => router.push(`/search?mode=case&case=${caseItem.id}`)}
              className="gap-1.5 text-xs"
            >
              <Search className="h-3.5 w-3.5" />
              New AI Search
            </Button>
          </div>

          <div className="rounded-xl border bg-card overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="border-b bg-muted/40 font-mono text-[11px] text-muted-foreground uppercase">
                <tr>
                  <th className="p-3">Job ID</th>
                  <th className="p-3">Scope Cameras</th>
                  <th className="p-3">Time Window</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Progress</th>
                  <th className="p-3">Candidates Found</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {searches.map((j) => (
                  <tr key={j.id} className="hover:bg-secondary/40">
                    <td className="p-3 font-mono font-semibold">{j.id}</td>
                    <td className="p-3">{j.cameraScopeCount} perimeter nodes</td>
                    <td className="p-3 font-mono">{j.timeRangeHours}h window</td>
                    <td className="p-3">
                      <Badge variant="outline" className="font-mono text-[10px] capitalize">
                        {j.status.replace(/_/g, ' ')}
                      </Badge>
                    </td>
                    <td className="p-3 font-mono">{j.progressPercent}%</td>
                    <td className="p-3 font-mono font-bold text-foreground">{j.candidatesFound}</td>
                    <td className="p-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => router.push(`/search/${j.id}`)}
                        className="h-7 text-xs"
                      >
                        View Results
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* =========================================================================
            TAB 4: REVIEW (EMBEDDED REVIEW WORKSPACE LINK / VIEW)
           ========================================================================= */}
        <TabsContent value="review" className="mt-6">
          <div className="rounded-xl border bg-card p-6 text-center space-y-4">
            <Eye className="h-10 w-10 text-amber-500 mx-auto" />
            <div className="space-y-1">
              <h3 className="text-base font-semibold">Verification Review Workspace</h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Review candidate sightings side-by-side with reference imagery, inspect 4-model algorithmic evidence, and apply human decisions.
              </p>
            </div>
            <div className="flex justify-center gap-3">
              <Button
                onClick={() => router.push(`/review?case=${caseItem.id}`)}
                className="gap-2 bg-primary text-primary-foreground"
              >
                Open Case Review Queue ({pendingCount} pending)
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* =========================================================================
            TAB 5: JOURNEY (EMBEDDED JOURNEY WORKSPACE LINK / VIEW)
           ========================================================================= */}
        <TabsContent value="journey" className="mt-6">
          <div className="rounded-xl border bg-card p-6 text-center space-y-4">
            <GitFork className="h-10 w-10 text-blue-500 mx-auto" />
            <div className="space-y-1">
              <h3 className="text-base font-semibold">Cross-Camera Tracking Journey</h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Explore multi-camera trajectory sequence, transition plausibility metrics, and reachable perimeter ring.
              </p>
            </div>
            <div className="flex justify-center gap-3">
              <Button
                onClick={() => router.push(`/journeys?case=${caseItem.id}`)}
                className="gap-2 bg-primary text-primary-foreground"
              >
                Open Full Journey Workspace
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* =========================================================================
            TAB 6: EVIDENCE (CANDIDATE EVIDENCE ITEMS)
           ========================================================================= */}
        <TabsContent value="evidence" className="mt-6 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sightings.map((sig) => (
              <SightingCard
                key={sig.id}
                sighting={sig}
                onClick={() => router.push(`/review?case=${caseItem.id}&item=${sig.id}`)}
              />
            ))}
          </div>
        </TabsContent>

        {/* =========================================================================
            TAB 7: ACTIVITY (AUDIT LOGS)
           ========================================================================= */}
        <TabsContent value="activity" className="mt-6 space-y-3">
          <div className="rounded-xl border bg-card divide-y">
            {auditLogs.map((log) => (
              <div key={log.id} className="p-4 flex items-center justify-between text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">{log.action}</span>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {log.actor}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground">{log.details}</p>
                </div>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {new Date(log.timestamp).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* =========================================================================
            TAB 8: REPORTS
           ========================================================================= */}
        <TabsContent value="reports" className="mt-6">
          <div className="rounded-xl border bg-card p-6 text-center space-y-3">
            <FileText className="h-8 w-8 text-muted-foreground mx-auto" />
            <h4 className="text-sm font-semibold">Statutory Case Export & Summary Reports</h4>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Generate chain of custody, sighting audit trail, and missing minor bulletins in compliant PDF format.
            </p>
            <Button size="sm" variant="outline" className="text-xs">
              Generate Investigation Summary (PDF)
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
