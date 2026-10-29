'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCases } from '@/hooks/use-cases';
import { useSightings } from '@/hooks/use-sightings';
import { isMinorFromDob } from '@/lib/model-registry';
import {
  StatusChip,
  PriorityChip,
  ReadinessRing,
  EmptyState,
  PersonCommand,
} from '@/components/shared';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  FolderPlus,
  LayoutGrid,
  Table as TableIcon,
  Search,
  Filter,
  Eye,
  GitFork,
  MapPin,
  Clock,
  ShieldAlert,
  Shield,
  ArrowRight,
  UserCheck,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Case } from '@/types';

type SavedView = 'all' | 'my_cases' | 'critical' | 'needs_review' | 'drafts';

export default function CasesPage() {
  const router = useRouter();
  const { data: cases = [] } = useCases();
  const { data: sightings = [] } = useSightings();
  const pendingCountByCase = React.useCallback(
    (caseId: string) => sightings.filter((s) => s.status === 'pending_review' && s.caseId === caseId).length,
    [sightings],
  );

  // Toolbar States
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [savedView, setSavedView] = useState<SavedView>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [officerFilter, setOfficerFilter] = useState('all');
  const [minorOnly, setMinorOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'updated' | 'priority' | 'readiness' | 'last_seen'>('updated');

  // Bulk selection in Table view
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Persist view mode in localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('sentinel_cases_view_mode');
      if (saved === 'cards' || saved === 'table') setViewMode(saved);
    } catch (e) {}
  }, []);

  const handleToggleViewMode = (mode: 'cards' | 'table') => {
    setViewMode(mode);
    try {
      localStorage.setItem('sentinel_cases_view_mode', mode);
    } catch (e) {}
  };

  // Filter & Sort Cases
  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      // Saved views
      if (savedView === 'my_cases' && !c.assignedOfficer.includes('Sarah Vance')) return false;
      if (savedView === 'critical' && c.priority !== 'critical') return false;
      if (savedView === 'needs_review' && pendingCountByCase(c.id) === 0) return false;
      if (savedView === 'drafts' && c.status !== 'closed') return false;

      // Status
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;

      // Priority
      if (priorityFilter !== 'all' && c.priority !== priorityFilter) return false;

      // Officer
      if (officerFilter !== 'all' && !c.assignedOfficer.includes(officerFilter)) return false;

      // Minor only
      if (minorOnly && !c.isMinor && !isMinorFromDob(c.lastSeenAt)) return false;

      // Search Query
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const match =
          c.personName.toLowerCase().includes(q) ||
          c.caseNumber.toLowerCase().includes(q) ||
          c.lastSeenLocation.toLowerCase().includes(q) ||
          (c.registrationAuth?.authority?.firOrCaseNumber || '').toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'priority') {
        const pWeight: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
        return (pWeight[b.priority] || 0) - (pWeight[a.priority] || 0);
      }
      if (sortBy === 'readiness') {
        const rA = a.referencePhotos?.length ? 88 : 30;
        const rB = b.referencePhotos?.length ? 88 : 30;
        return rB - rA;
      }
      return new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime();
    });
  }, [cases, savedView, statusFilter, priorityFilter, officerFilter, minorOnly, searchQuery, sortBy, pendingCountByCase]);

  // Handle select all
  const handleSelectAll = (checked: boolean) => {
    if (checked) setSelectedIds(filteredCases.map((c) => c.id));
    else setSelectedIds([]);
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  return (
    <div className="space-y-6 select-none">
      {/* 1. Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Cases & Missing Persons</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Active missing person dossiers, biometric reference sets, and search scopes
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => router.push('/cases/new')}
            className="gap-1.5 shadow-sm bg-primary text-primary-foreground"
          >
            <FolderPlus className="h-4 w-4" />
            Register Missing Person
          </Button>
        </div>
      </div>

      {/* 2. Saved Views Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 border-b sm:border-b-0 pb-1 sm:pb-0 overflow-x-auto">
          {[
            { id: 'all', label: 'All Cases', count: cases.length },
            { id: 'my_cases', label: 'My Cases', count: cases.filter((c) => c.assignedOfficer.includes('Sarah Vance')).length },
            { id: 'critical', label: 'Critical', count: cases.filter((c) => c.priority === 'critical').length },
            { id: 'needs_review', label: 'Needs Review', count: cases.filter((c) => pendingCountByCase(c.id) > 0).length },
            { id: 'drafts', label: 'Drafts', count: cases.filter((c) => c.status === 'closed').length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSavedView(tab.id as SavedView)}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                savedView === tab.id
                  ? 'bg-secondary text-foreground font-semibold shadow-xs border'
                  : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground',
              )}
            >
              <span>{tab.label}</span>
              <span className="font-mono text-[10px] opacity-70">({tab.count})</span>
            </button>
          ))}
        </div>

        {/* View mode toggle: cards | table */}
        <div className="flex items-center border rounded-lg p-0.5 bg-background shadow-2xs">
          <Button
            variant={viewMode === 'cards' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => handleToggleViewMode('cards')}
            className="h-7 px-2 text-xs gap-1"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Cards
          </Button>
          <Button
            variant={viewMode === 'table' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => handleToggleViewMode('table')}
            className="h-7 px-2 text-xs gap-1"
          >
            <TableIcon className="h-3.5 w-3.5" />
            Table
          </Button>
        </div>
      </div>

      {/* 3. Filter Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-xl border bg-card p-3 shadow-2xs">
        {/* Person picker / text search */}
        <div className="flex-1 min-w-[240px]">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by name, alias, case #, FIR, or location..."
            className="h-9 text-xs bg-background"
          />
        </div>

        {/* Status Filter */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-32 text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="under_review">Under Review</SelectItem>
            <SelectItem value="found">Found</SelectItem>
            <SelectItem value="closed">Closed / Draft</SelectItem>
          </SelectContent>
        </Select>

        {/* Priority Filter */}
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="h-9 w-32 text-xs">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>

        {/* Minor Only Toggle */}
        <Button
          variant={minorOnly ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => setMinorOnly(!minorOnly)}
          className={cn(
            'h-9 text-xs gap-1.5',
            minorOnly && 'border-amber-500/40 text-amber-600 dark:text-amber-400 font-semibold',
          )}
        >
          <Shield className="h-3.5 w-3.5" />
          Minor Only
        </Button>

        {/* Sort */}
        <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
          <SelectTrigger className="h-9 w-36 text-xs">
            <SelectValue placeholder="Sort By" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="updated">Recent Activity</SelectItem>
            <SelectItem value="priority">Priority</SelectItem>
            <SelectItem value="readiness">Readiness</SelectItem>
            <SelectItem value="last_seen">Last Seen</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 4. Content View */}
      {filteredCases.length === 0 ? (
        <EmptyState
          title="No cases match the active criteria"
          description="Try clearing your search query or adjusting the filters above."
          actionLabel="Clear Filters"
          onAction={() => {
            setSearchQuery('');
            setStatusFilter('all');
            setPriorityFilter('all');
            setMinorOnly(false);
            setSavedView('all');
          }}
        />
      ) : viewMode === 'cards' ? (
        /* CARDS VIEW */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredCases.map((c) => {
            const isDraft = c.status === 'closed' && c.referenceSetVersion === 0;
            const isMinor = c.isMinor || isMinorFromDob(c.lastSeenAt);
            const pendingCount = pendingCountByCase(c.id);
            const primaryRef =
              c.referencePhotos?.[0]?.url ||
              'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80';

            return (
              <Card
                key={c.id}
                className="group relative flex flex-col justify-between overflow-hidden rounded-xl border bg-card transition-all hover:border-primary/50 hover:shadow-md"
              >
                <div>
                  {/* Top Bar with Case & Status */}
                  <div className="flex items-center justify-between border-b px-4 py-3 bg-muted/15">
                    <div className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                      <span>{c.caseNumber}</span>
                      {c.registrationAuth?.authority?.firOrCaseNumber && (
                        <span>• FIR-{c.registrationAuth.authority.firOrCaseNumber.slice(-4)}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <PriorityChip priority={c.priority} size="sm" />
                      <StatusChip status={c.status} size="sm" />
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-14 w-14 border rounded-lg shrink-0">
                        <AvatarImage src={primaryRef} alt={c.personName} className="object-cover" />
                        <AvatarFallback>{c.personName.slice(0, 2)}</AvatarFallback>
                      </Avatar>

                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                            {c.personName}
                          </h3>
                          {isMinor && (
                            <Badge
                              variant="outline"
                              className="border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] px-1 py-0 font-mono shrink-0"
                            >
                              Minor
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground line-clamp-1">{c.description}</p>
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{c.lastSeenLocation}</span>
                        </div>
                      </div>
                    </div>

                    {/* Readiness & Progress strip */}
                    <div className="flex items-center justify-between rounded-lg border bg-secondary/15 px-3 py-2 text-xs">
                      <div className="flex items-center gap-2">
                        <ReadinessRing score={c.referencePhotos?.length ? 88 : 30} size={28} showText={false} />
                        <span className="font-mono text-[11px] text-muted-foreground">
                          Readiness: {c.referencePhotos?.length ? '88%' : '30%'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] font-mono">
                        <span>Hops: {c.sightingsCount}</span>
                        {pendingCount > 0 && (
                          <span className="text-amber-600 dark:text-amber-400 font-bold">
                            {pendingCount} to review
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="flex items-center justify-between border-t px-4 py-2.5 bg-muted/5 gap-2">
                  {isDraft ? (
                    <Button
                      size="sm"
                      onClick={() => router.push(`/cases/new?draft=${c.id}`)}
                      className="w-full text-xs"
                      variant="outline"
                    >
                      Resume Draft
                    </Button>
                  ) : (
                    <>
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => router.push(`/search?mode=case&case=${c.id}`)}
                          className="h-7 text-xs px-2 gap-1 text-muted-foreground hover:text-foreground"
                        >
                          <Search className="h-3 w-3" />
                          Search
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => router.push(`/review?case=${c.id}`)}
                          className="h-7 text-xs px-2 gap-1 text-muted-foreground hover:text-foreground"
                        >
                          <Eye className="h-3 w-3" />
                          Review ({pendingCount})
                        </Button>
                      </div>

                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => router.push(`/cases/${c.id}`)}
                        className="h-7 text-xs gap-1"
                      >
                        Open Dossier
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="rounded-xl border bg-card overflow-hidden shadow-2xs">
          {selectedIds.length > 0 && (
            <div className="flex items-center justify-between border-b bg-secondary/40 px-4 py-2 text-xs">
              <span className="font-medium">{selectedIds.length} cases selected</span>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="h-7 text-xs">
                  Bulk Assign Officer
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs">
                  Change Priority
                </Button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b bg-muted/40 font-mono text-[11px] text-muted-foreground uppercase">
                <tr>
                  <th className="p-3 w-8">
                    <Checkbox
                      checked={selectedIds.length === filteredCases.length && filteredCases.length > 0}
                      onCheckedChange={(checked) => handleSelectAll(Boolean(checked))}
                    />
                  </th>
                  <th className="p-3">Person</th>
                  <th className="p-3">Case No</th>
                  <th className="p-3">Priority</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Last Seen</th>
                  <th className="p-3">Pending Review</th>
                  <th className="p-3">Assigned Officer</th>
                  <th className="p-3">Readiness</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredCases.map((c) => {
                  const isMinor = c.isMinor || isMinorFromDob(c.lastSeenAt);
                  const pendingCount = pendingCountByCase(c.id);
                  const isChecked = selectedIds.includes(c.id);

                  return (
                    <tr
                      key={c.id}
                      onClick={() => router.push(`/cases/${c.id}`)}
                      className={cn(
                        'hover:bg-secondary/40 cursor-pointer transition-colors',
                        isChecked && 'bg-secondary/20',
                      )}
                    >
                      <td className="p-3" onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={isChecked} onCheckedChange={() => handleToggleSelect(c.id)} />
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar className="h-7 w-7 border shrink-0">
                            <AvatarImage src={c.referencePhotos?.[0]?.url} alt={c.personName} />
                            <AvatarFallback>{c.personName.slice(0, 2)}</AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5 font-semibold text-foreground">
                              <span>{c.personName}</span>
                              {isMinor && (
                                <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-500/40 text-amber-500">
                                  Minor
                                </Badge>
                              )}
                            </div>
                            <span className="text-[10px] text-muted-foreground">Age ~{c.age}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 font-mono">{c.caseNumber}</td>
                      <td className="p-3">
                        <PriorityChip priority={c.priority} size="sm" />
                      </td>
                      <td className="p-3">
                        <StatusChip status={c.status} size="sm" />
                      </td>
                      <td className="p-3">
                        <div className="flex flex-col">
                          <span className="truncate max-w-[140px]">{c.lastSeenLocation}</span>
                          <span className="text-[10px] font-mono text-muted-foreground">
                            {new Date(c.lastSeenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </td>
                      <td className="p-3 font-mono">
                        {pendingCount > 0 ? (
                          <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-500 text-[10px]">
                            {pendingCount} review
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-3 text-muted-foreground">{c.assignedOfficer}</td>
                      <td className="p-3">
                        <ReadinessRing score={c.referencePhotos?.length ? 88 : 30} size={24} showText={false} />
                      </td>
                      <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => router.push(`/review?case=${c.id}`)}
                            className="h-7 text-xs px-2"
                          >
                            Review
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => router.push(`/cases/${c.id}`)}
                            className="h-7 text-xs px-2.5"
                          >
                            Open
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
