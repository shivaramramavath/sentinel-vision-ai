'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { alertService } from '@/services/alert.service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Bell,
  ShieldAlert,
  CheckCircle2,
  SlidersHorizontal,
  Radio,
  Mail,
  MessageSquare,
  Users,
  ArrowRight,
  ExternalLink,
  Plus,
  Clock,
  Filter,
  Eye,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Layers,
  Send,
  Zap,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AlertEvent, AlertRule, DispatchChannel, OnCallShift } from '@sentinel/shared-types';

export default function AlertsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const rawTab = searchParams.get('tab') || 'inbox';
  const tab = ['inbox', 'rules', 'channels', 'oncall'].includes(rawTab) ? rawTab : 'inbox';
  const statusFilter = searchParams.get('status') || 'all';
  const severityFilter = searchParams.get('severity') || 'all';
  const typeFilter = searchParams.get('type') || 'all';

  const setTab = useCallback(
    (newTab: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', newTab);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === 'all') params.delete(key);
      else params.set(key, value);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  // Queries
  const { data: summary, refetch: refetchSummary } = useQuery({
    queryKey: ['alerts', 'summary'],
    queryFn: () => alertService.getSummary(),
    staleTime: 15_000,
  });

  const { data: alertsList = [], refetch: refetchAlerts, isLoading } = useQuery<AlertEvent[]>({
    queryKey: ['alerts', 'list', statusFilter, severityFilter, typeFilter],
    queryFn: () => alertService.getAll({ status: statusFilter, severity: severityFilter, type: typeFilter }),
    staleTime: 15_000,
  });

  const { data: rules = [], refetch: refetchRules } = useQuery<AlertRule[]>({
    queryKey: ['alerts', 'rules'],
    queryFn: () => alertService.getRules(),
  });

  const { data: channels = [], refetch: refetchChannels } = useQuery<DispatchChannel[]>({
    queryKey: ['alerts', 'channels'],
    queryFn: () => alertService.getChannels(),
  });

  const { data: onCallList = [], refetch: refetchOnCall } = useQuery<OnCallShift[]>({
    queryKey: ['alerts', 'oncall'],
    queryFn: () => alertService.getOnCall(),
  });

  // Local state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  // Modals
  const [resolveItem, setResolveItem] = useState<AlertEvent | null>(null);
  const [resolveNote, setResolveNote] = useState<string>('Checked with station security — false trigger');
  const [testRuleResult, setTestRuleResult] = useState<any | null>(null);
  const [testChannelResult, setTestChannelResult] = useState<any | null>(null);
  const [showAddRuleModal, setShowAddRuleModal] = useState<boolean>(false);
  const [newRuleName, setNewRuleName] = useState<string>('Critical Sighting Geofence Breach');

  // Fallback seed alerts if DB collection empty
  const displayAlerts = useMemo<AlertEvent[]>(() => {
    if (alertsList.length > 0) return alertsList;
    return [
      {
        id: 'al_01',
        dedupeKey: 'cam_01_maya_lin',
        occurrenceCount: 3,
        firstOccurrenceAt: new Date(Date.now() - 3600000 * 2).toISOString(),
        lastOccurrenceAt: new Date(Date.now() - 60000 * 4).toISOString(),
        severity: 'critical',
        status: 'new',
        type: 'detection',
        title: 'High-Confidence Biometric Match on CAM-001',
        message: 'Candidate matching MP-2026-0042 (Maya Lin) detected with 89% similarity',
        caseId: 'case_001',
        caseNumber: 'MP-2026-0042',
        personName: 'Maya Lin',
        cameraId: 'cam_01',
        cameraCode: 'CAM-001',
        locationName: 'Metro Central - Platform 3',
        candidateCropUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        referenceCropUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        fusedScore: 0.89,
        matchBand: 'high',
        slaDueAt: new Date(Date.now() + 60000 * 8).toISOString(),
        slaMinutesRemaining: 8,
        isEscalated: false,
      },
      {
        id: 'al_02',
        dedupeKey: 'cam_04_offline',
        occurrenceCount: 1,
        firstOccurrenceAt: new Date(Date.now() - 3600000 * 1).toISOString(),
        lastOccurrenceAt: new Date(Date.now() - 3600000 * 1).toISOString(),
        severity: 'critical',
        status: 'new',
        type: 'camera',
        title: 'Edge Ingestion Stream Dropped in Search Radius',
        message: 'CAM-004 (Station Square Crosswalk) unreachable inside active reachable area',
        caseId: 'case_001',
        caseNumber: 'MP-2026-0042',
        personName: 'Maya Lin',
        cameraId: 'cam_04',
        cameraCode: 'CAM-004',
        locationName: 'Station Square Crosswalk',
        slaDueAt: new Date(Date.now() - 60000 * 12).toISOString(),
        slaMinutesRemaining: 0,
        isEscalated: true,
      },
      {
        id: 'al_03',
        dedupeKey: 'search_job_comp',
        occurrenceCount: 1,
        firstOccurrenceAt: new Date(Date.now() - 3600000 * 3).toISOString(),
        lastOccurrenceAt: new Date(Date.now() - 3600000 * 3).toISOString(),
        severity: 'info',
        status: 'acknowledged',
        type: 'queue',
        title: 'Search Job #482 Completed',
        message: 'Scanned 32 cameras across East Terminal; 8 candidate detections ranked for review',
        caseId: 'case_002',
        caseNumber: 'MP-2026-0018',
        personName: 'Marcus Vance',
        isEscalated: false,
      },
    ];
  }, [alertsList]);

  // Keyboard navigation: J/K to move, A to ack, S to snooze, E to escalate
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (tab !== 'inbox') return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'j' || e.key === 'ArrowDown') {
        setSelectedIndex((prev) => Math.min(displayAlerts.length - 1, prev + 1));
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        setSelectedIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === 'a' || e.key === 'A') {
        const item = displayAlerts[selectedIndex];
        if (item) alertService.acknowledge(item.id).then(() => refetchAlerts());
      } else if (e.key === 's' || e.key === 'S') {
        const item = displayAlerts[selectedIndex];
        if (item) alertService.snooze(item.id, 60).then(() => refetchAlerts());
      } else if (e.key === 'e' || e.key === 'E') {
        const item = displayAlerts[selectedIndex];
        if (item) alertService.escalate(item.id).then(() => refetchAlerts());
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tab, displayAlerts, selectedIndex, refetchAlerts]);

  // Bulk action handlers
  const handleBulkAction = async (action: 'ack' | 'resolve' | 'snooze') => {
    if (selectedIds.size === 0) return;
    await alertService.bulkAction(action, Array.from(selectedIds));
    setSelectedIds(new Set());
    refetchAlerts();
    refetchSummary();
  };

  const handleResolveAlert = async () => {
    if (!resolveItem) return;
    await alertService.resolve(resolveItem.id, resolveNote);
    setResolveItem(null);
    refetchAlerts();
    refetchSummary();
  };

  const handleSimulateRule = async (id: string) => {
    const res = await alertService.testRule(id);
    setTestRuleResult(res);
  };

  const handleTestChannel = async (id: string) => {
    const res = await alertService.testChannel(id);
    setTestChannelResult(res);
  };

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-3 pt-1">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Alerts &amp; Dispatch Rules
          </h1>
          <p className="text-xs text-muted-foreground">
            Deduplicated incident stream, SLA escalation countdowns &amp; tactical paging
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground">
            Keyboard: J/K Navigate · A Acknowledge · S Snooze · E Escalate
          </Badge>
        </div>
      </header>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="bg-muted/40 p-1 font-mono text-xs">
          <TabsTrigger value="inbox" className="gap-1.5 px-3">
            <Bell className="h-3.5 w-3.5" />
            <span>Alert Inbox</span>
            {summary?.criticalCount ? (
              <Badge variant="destructive" className="ml-1 px-1 py-0 text-[9px] h-4">
                {summary.criticalCount}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="rules" className="gap-1.5 px-3">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>Rules Engine</span>
          </TabsTrigger>
          <TabsTrigger value="channels" className="gap-1.5 px-3">
            <Radio className="h-3.5 w-3.5" />
            <span>Dispatch Channels</span>
          </TabsTrigger>
          <TabsTrigger value="oncall" className="gap-1.5 px-3">
            <Users className="h-3.5 w-3.5" />
            <span>Tactical On-Call</span>
          </TabsTrigger>
        </TabsList>

        {/* ================= TAB 1: INBOX ================= */}
        <TabsContent value="inbox" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Left Filter Sidebar */}
            <aside className="md:col-span-3 space-y-3">
              <Card className="p-3 space-y-3 text-xs">
                <div>
                  <span className="font-mono uppercase text-[10px] text-muted-foreground font-semibold">
                    Status Filter
                  </span>
                  <div className="space-y-1 mt-1.5 font-mono">
                    {['all', 'new', 'acknowledged', 'assigned', 'snoozed', 'resolved'].map((s) => (
                      <button
                        key={s}
                        onClick={() => updateParam('status', s)}
                        className={cn(
                          'w-full text-left px-2.5 py-1 rounded-md capitalize transition-colors flex items-center justify-between',
                          statusFilter === s ? 'bg-primary text-primary-foreground font-semibold' : 'hover:bg-muted/40 text-muted-foreground',
                        )}
                      >
                        <span>{s}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border-t pt-2">
                  <span className="font-mono uppercase text-[10px] text-muted-foreground font-semibold">
                    Severity
                  </span>
                  <div className="space-y-1 mt-1.5 font-mono">
                    {['all', 'critical', 'warning', 'info'].map((sev) => (
                      <button
                        key={sev}
                        onClick={() => updateParam('severity', sev)}
                        className={cn(
                          'w-full text-left px-2.5 py-1 rounded-md capitalize transition-colors',
                          severityFilter === sev ? 'bg-primary text-primary-foreground font-semibold' : 'hover:bg-muted/40 text-muted-foreground',
                        )}
                      >
                        {sev}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border-t pt-2">
                  <span className="font-mono uppercase text-[10px] text-muted-foreground font-semibold">
                    Source Type
                  </span>
                  <div className="space-y-1 mt-1.5 font-mono">
                    {['all', 'detection', 'camera', 'system', 'queue'].map((t) => (
                      <button
                        key={t}
                        onClick={() => updateParam('type', t)}
                        className={cn(
                          'w-full text-left px-2.5 py-1 rounded-md capitalize transition-colors',
                          typeFilter === t ? 'bg-primary text-primary-foreground font-semibold' : 'hover:bg-muted/40 text-muted-foreground',
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </Card>
            </aside>

            {/* Right Alerts List & Actions */}
            <main className="md:col-span-9 space-y-3">
              {/* Bulk Action Bar */}
              {selectedIds.size > 0 && (
                <div className="p-2.5 rounded-lg border bg-muted/40 flex items-center justify-between text-xs font-mono animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{selectedIds.size} alerts selected</span>
                    <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => setSelectedIds(new Set())}>
                      Clear
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleBulkAction('ack')}>
                      Acknowledge All
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleBulkAction('snooze')}>
                      Snooze 1h
                    </Button>
                    <Button size="sm" className="h-7 text-xs" onClick={() => handleBulkAction('resolve')}>
                      Resolve All
                    </Button>
                  </div>
                </div>
              )}

              {/* Alert Items */}
              <div className="space-y-2">
                {displayAlerts.map((alert, idx) => {
                  const isSelected = selectedIds.has(alert.id);
                  const isFocused = idx === selectedIndex;
                  const isExpanded = expandedId === alert.id;
                  const isDetection = alert.type === 'detection';

                  return (
                    <Card
                      key={alert.id}
                      className={cn(
                        'transition-all border overflow-hidden',
                        isFocused && 'ring-1 ring-primary/40',
                        alert.severity === 'critical' ? 'border-rose-500/40 bg-rose-500/5' : 'bg-card',
                      )}
                    >
                      <div className="p-3.5 space-y-2.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                setSelectedIds((prev) => {
                                  const n = new Set(prev);
                                  if (n.has(alert.id)) n.delete(alert.id);
                                  else n.add(alert.id);
                                  return n;
                                });
                              }}
                              className="mt-1 h-3.5 w-3.5 rounded border"
                            />

                            {/* Severity icon: amber for possible detections, red only for system failures/offline */}
                            <div className="mt-0.5 shrink-0">
                              {isDetection ? (
                                <Zap className="h-4 w-4 text-amber-500" />
                              ) : alert.severity === 'critical' ? (
                                <ShieldAlert className="h-4 w-4 text-rose-500" />
                              ) : (
                                <Bell className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-xs text-foreground truncate">
                                  {alert.title}
                                </span>
                                {alert.occurrenceCount > 1 && (
                                  <Badge variant="secondary" className="font-mono text-[9px] px-1 py-0 h-4">
                                    ×{alert.occurrenceCount} occurrences
                                  </Badge>
                                )}
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    'font-mono text-[9px] uppercase px-1 py-0 h-4',
                                    isDetection ? 'border-amber-500 text-amber-500' : 'border-border',
                                  )}
                                >
                                  {alert.type}
                                </Badge>
                                {alert.caseNumber && (
                                  <Link
                                    href={`/cases/${alert.caseId}`}
                                    className="text-[10px] font-mono text-primary hover:underline"
                                  >
                                    {alert.caseNumber}
                                  </Link>
                                )}
                              </div>

                              <p className="text-xs text-muted-foreground mt-0.5">{alert.message}</p>
                            </div>
                          </div>

                          {/* SLA Timer & Status */}
                          <div className="flex flex-col items-end gap-1 shrink-0 font-mono text-[10px]">
                            {alert.slaMinutesRemaining !== undefined && (
                              <Badge
                                variant={alert.slaMinutesRemaining <= 0 ? 'destructive' : 'outline'}
                                className={cn('text-[9px] px-1.5 py-0 h-4', alert.slaMinutesRemaining <= 0 && 'animate-pulse')}
                              >
                                <Clock className="h-2.5 w-2.5 mr-1" />
                                {alert.slaMinutesRemaining <= 0 ? 'SLA ESCALATED' : `Review in ${alert.slaMinutesRemaining}m`}
                              </Badge>
                            )}
                            <span className="text-muted-foreground">
                              {new Date(alert.lastOccurrenceAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>

                        {/* Inline Actions */}
                        <div className="flex items-center justify-between pt-1 border-t border-border/40 text-xs">
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : alert.id)}
                            className="text-[11px] font-mono text-muted-foreground hover:text-foreground flex items-center gap-1"
                          >
                            <span>{isExpanded ? 'Hide Details' : 'Expand Details'}</span>
                            {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                          </button>

                          <div className="flex items-center gap-1.5">
                            {isDetection && (
                              <Link href={`/review?case=${alert.caseId || ''}`}>
                                <Button size="sm" variant="outline" className="h-6 text-[11px] px-2 gap-1 font-medium">
                                  <span>Open in Review</span>
                                  <ExternalLink className="h-2.5 w-2.5" />
                                </Button>
                              </Link>
                            )}

                            {alert.type === 'camera' && (
                              <Link href={`/cameras?camera=${alert.cameraCode || ''}`}>
                                <Button size="sm" variant="outline" className="h-6 text-[11px] px-2 gap-1 font-medium">
                                  <span>Open Camera</span>
                                  <ExternalLink className="h-2.5 w-2.5" />
                                </Button>
                              </Link>
                            )}

                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-[11px] px-2"
                              onClick={() => {
                                alertService.acknowledge(alert.id).then(() => refetchAlerts());
                              }}
                            >
                              Ack
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-[11px] px-2"
                              onClick={() => {
                                alertService.snooze(alert.id, 60).then(() => refetchAlerts());
                              }}
                            >
                              Snooze 1h
                            </Button>

                            <Button
                              size="sm"
                              className="h-6 text-[11px] px-2"
                              onClick={() => setResolveItem(alert)}
                            >
                              Resolve
                            </Button>
                          </div>
                        </div>

                        {/* Expanded details view */}
                        {isExpanded && (
                          <div className="p-3 mt-2 rounded-lg bg-muted/20 border border-border/60 text-xs font-mono space-y-2 animate-in fade-in">
                            <div className="grid grid-cols-2 gap-2 text-[11px]">
                              <div>Camera Code: {alert.cameraCode || 'CAM-001'}</div>
                              <div>Location: {alert.locationName || 'Metro Network'}</div>
                              <div>First Occurred: {new Date(alert.firstOccurrenceAt).toLocaleString()}</div>
                              <div>Dedupe Key: {alert.dedupeKey}</div>
                            </div>

                            {/* Mini evidence preview if detection */}
                            {isDetection && alert.candidateCropUrl && (
                              <div className="flex items-center gap-3 p-2 rounded bg-card border">
                                <div className="relative h-12 w-12 rounded border bg-muted overflow-hidden shrink-0">
                                  <Image
                                    src={alert.candidateCropUrl}
                                    alt=""
                                    width={48}
                                    height={48}
                                    className="object-cover h-full w-full"
                                  />
                                </div>
                                <div className="space-y-0.5">
                                  <div className="font-semibold text-foreground">
                                    Similarity: {Math.round((alert.fusedScore || 0.85) * 100)}%
                                  </div>
                                  <div className="text-[10px] text-muted-foreground">
                                    Status: Possible Match (Human Decision Required)
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </main>
          </div>
        </TabsContent>

        {/* ================= TAB 2: RULES ================= */}
        <TabsContent value="rules" className="space-y-4">
          <Card>
            <CardHeader className="p-4 border-b bg-card flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">Configured Trigger Rules</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Automated evaluation of candidate similarity thresholds, camera telemetry &amp; queue lag
                </p>
              </div>
              <Button size="sm" className="h-8 gap-1.5 text-xs font-medium" onClick={() => setShowAddRuleModal(true)}>
                <Plus className="h-3.5 w-3.5" />
                <span>Create Rule</span>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/60 text-xs">
                {rules.map((rule) => (
                  <div key={rule.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-foreground">{rule.name}</span>
                        <Badge variant="outline" className="font-mono text-[9px] uppercase">
                          {rule.actions.severity}
                        </Badge>
                        <Badge variant="secondary" className="font-mono text-[9px]">
                          v{rule.version}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{rule.description}</p>
                      <div className="text-[10px] font-mono text-muted-foreground">
                        Channels: {rule.actions.notifyChannels.join(', ')} · Owner: {rule.owner}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs font-medium font-mono"
                        onClick={() => handleSimulateRule(rule.id)}
                      >
                        Simulate 24h Data
                      </Button>
                      <Switch defaultChecked={rule.enabled} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Test simulation result callout */}
          {testRuleResult && (
            <div className="p-3 rounded-lg border border-primary/40 bg-primary/5 text-xs font-mono space-y-1">
              <div className="font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-primary" />
                <span>24-Hour Rule Simulation: {testRuleResult.simulatedEventsCount} trigger events would have fired</span>
              </div>
              <ul className="list-disc pl-4 text-muted-foreground text-[11px] space-y-0.5">
                {testRuleResult.sampleMatches.map((m: string, i: number) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>
          )}
        </TabsContent>

        {/* ================= TAB 3: CHANNELS ================= */}
        <TabsContent value="channels" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {channels.map((chan) => (
              <Card key={chan.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Radio className="h-4 w-4 text-primary" />
                    <div>
                      <div className="font-semibold text-xs text-foreground">{chan.name}</div>
                      <div className="text-[10px] font-mono text-muted-foreground">{chan.endpointOrTarget}</div>
                    </div>
                  </div>
                  <Badge variant="outline" className="font-mono text-emerald-500 text-[9px]">
                    {chan.deliverySuccessRatePct}% SLA
                  </Badge>
                </div>

                <div className="text-[11px] font-mono text-muted-foreground flex justify-between">
                  <span>Rate Limit: {chan.rateLimitPerMinute} / min</span>
                  <span>Last: {chan.lastDeliveryStatus || 'delivered'}</span>
                </div>

                <div className="pt-1 flex items-center justify-between border-t border-border/40">
                  <Switch defaultChecked={chan.enabled} />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-[10px] px-2 font-mono"
                    onClick={() => handleTestChannel(chan.id)}
                  >
                    Test Send
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          {testChannelResult && (
            <div className="p-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-500 text-xs font-mono flex items-center justify-between">
              <span>{testChannelResult.statusMessage} ({testChannelResult.latencyMs} ms)</span>
              <button onClick={() => setTestChannelResult(null)}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </TabsContent>

        {/* ================= TAB 4: ON-CALL ================= */}
        <TabsContent value="oncall" className="space-y-4">
          <Card>
            <CardHeader className="p-4 border-b bg-card">
              <CardTitle className="text-sm font-semibold">Incident Command Escalation Tiers</CardTitle>
              <p className="text-xs text-muted-foreground">
                Tier 1: On-Call Investigator (immediate) $\to$ Tier 2: Shift Supervisor (after 10 min) $\to$ Tier 3: Admin (after 20 min)
              </p>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {onCallList.map((shift) => (
                <div
                  key={shift.id}
                  className={cn(
                    'p-3 rounded-lg border flex items-center justify-between gap-3 text-xs',
                    shift.isCurrentlyActive ? 'border-emerald-500/40 bg-emerald-500/5' : 'bg-card',
                  )}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{shift.officerName}</span>
                      <Badge variant="outline" className="font-mono text-[9px]">
                        Tier {shift.tier} · {shift.role}
                      </Badge>
                      {shift.isCurrentlyActive && (
                        <Badge variant="outline" className="font-mono text-emerald-500 text-[9px]">
                          CURRENT COMMANDER
                        </Badge>
                      )}
                    </div>
                    <div className="text-[11px] font-mono text-muted-foreground mt-0.5">
                      Callsign: {shift.radioCallSign} · Phone: {shift.contactPhone}
                    </div>
                  </div>

                  {!shift.isCurrentlyActive && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs font-medium"
                      onClick={() => alertService.overrideOnCall(shift.officerId).then(() => refetchOnCall())}
                    >
                      Assume Duty
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ================= RESOLVE ALERT MODAL ================= */}
      {resolveItem && (
        <Dialog open={Boolean(resolveItem)} onOpenChange={() => setResolveItem(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">Resolve Alert Notification</DialogTitle>
              <DialogDescription className="text-xs">
                Provide an audit resolution note before clearing this incident from the active queue.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div className="space-y-1">
                <label className="font-medium">Incident:</label>
                <div className="p-2.5 rounded border bg-muted/20 font-mono text-[11px] text-muted-foreground">
                  {resolveItem.title}
                </div>
              </div>
              <div className="space-y-1">
                <label className="font-medium">Resolution Note:</label>
                <Input
                  value={resolveNote}
                  onChange={(e) => setResolveNote(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" size="sm" onClick={() => setResolveItem(null)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleResolveAlert}>
                Confirm Resolution
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ================= CREATE RULE MODAL ================= */}
      {showAddRuleModal && (
        <Dialog open={showAddRuleModal} onOpenChange={setShowAddRuleModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">Create Trigger Rule</DialogTitle>
              <DialogDescription className="text-xs">
                Configure automated threshold detection and dispatch actions
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div className="space-y-1">
                <label className="font-medium">Rule Name:</label>
                <Input
                  value={newRuleName}
                  onChange={(e) => setNewRuleName(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="font-medium">Trigger Condition:</label>
                <select className="h-8 w-full rounded border bg-card px-2 text-xs font-mono focus:outline-none">
                  <option>Sighting Fused Score &gt;= 85% for Critical Cases</option>
                  <option>Camera Offline in Active Reachable Zone</option>
                  <option>Review Wait Time Exceeds 10 Min SLA</option>
                  <option>DLQ Message Backlog &gt; 0</option>
                </select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" size="sm" onClick={() => setShowAddRuleModal(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  alertService.createRule({ name: newRuleName }).then(() => {
                    setShowAddRuleModal(false);
                    refetchRules();
                  });
                }}
              >
                Save Rule
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
