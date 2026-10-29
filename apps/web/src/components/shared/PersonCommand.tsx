'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useCases } from '@/hooks/use-cases';
import { useUiStore } from '@/stores/ui.store';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PriorityChip } from './PriorityChip';
import { StatusChip } from './StatusChip';
import { KbdHint } from './KbdHint';
import {
  Search,
  Camera,
  Upload,
  UserPlus,
  Eye,
  GitFork,
  LayoutDashboard,
  ShieldAlert,
  Clock,
  Sparkles,
  ChevronDown,
  X,
  FileCheck2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Case } from '@/types';

interface PersonCommandProps {
  isInlinePicker?: boolean;
  selectedCaseId?: string;
  onSelectCase?: (caseItem: Case) => void;
  className?: string;
  placeholder?: string;
}

export function PersonCommand({
  isInlinePicker = false,
  selectedCaseId,
  onSelectCase,
  className,
  placeholder = 'Search person, alias, case #, FIR...',
}: PersonCommandProps) {
  const router = useRouter();
  const { cmdKOpen, setCmdKOpen, setActiveCaseId } = useUiStore();
  const { data: cases = [] } = useCases();

  // Local state for inline popover
  const [inlineOpen, setInlineOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'text' | 'photo'>('text');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [recentIds, setRecentIds] = useState<string[]>(['case_001', 'case_002']);

  // Photo search state
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState<string | null>(null);
  const [photoSearching, setPhotoSearching] = useState(false);
  const [photoCandidates, setPhotoCandidates] = useState<
    Array<{ caseItem: Case; similarity: number; disclaimer: string }>
  >([]);

  // Listen for global Cmd/Ctrl+K when not inline
  useEffect(() => {
    if (isInlinePicker) return;
    const down = (e: KeyboardEvent) => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCmdKOpen(!cmdKOpen);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [cmdKOpen, isInlinePicker, setCmdKOpen]);

  // Load recents from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('sentinel_recent_cases');
      if (stored) {
        setRecentIds(JSON.parse(stored));
      }
    } catch (e) {
      // ignore
    }
  }, []);

  const handleSelectCaseInternal = (caseItem: Case) => {
    // Record to recents
    const nextRecents = [caseItem.id, ...recentIds.filter((id) => id !== caseItem.id)].slice(0, 5);
    setRecentIds(nextRecents);
    try {
      localStorage.setItem('sentinel_recent_cases', JSON.stringify(nextRecents));
    } catch (e) {}

    setActiveCaseId(caseItem.id);

    if (onSelectCase) {
      onSelectCase(caseItem);
    } else {
      router.push(`/cases/${caseItem.id}`);
    }

    setCmdKOpen(false);
    setInlineOpen(false);
  };

  // Filtered cases
  const filteredCases = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return cases.filter((c) => {
      if (selectedFilter !== 'all') {
        if (selectedFilter === 'critical' && c.priority !== 'critical') return false;
        if (selectedFilter === 'active' && c.status !== 'active') return false;
        if (selectedFilter === 'under_review' && c.status !== 'under_review') return false;
        if (selectedFilter === 'minor' && !c.isMinor) return false;
      }
      if (!q) return true;
      return (
        c.personName.toLowerCase().includes(q) ||
        c.caseNumber.toLowerCase().includes(q) ||
        c.lastSeenLocation.toLowerCase().includes(q) ||
        (c.registrationAuth?.authority?.firOrCaseNumber || '').toLowerCase().includes(q)
      );
    });
  }, [cases, searchQuery, selectedFilter]);

  // Groups
  const recentCases = useMemo(() => {
    return recentIds
      .map((id) => cases.find((c) => c.id === id))
      .filter((c): c is Case => Boolean(c));
  }, [recentIds, cases]);

  const activeJourneysCases = useMemo(() => {
    return cases.filter((c) => c.status === 'active' && c.sightingsCount > 0);
  }, [cases]);

  // Photo search simulation
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setUploadedPhotoUrl(url);
    runPhotoSearch(url);
  };

  const runPhotoSearch = (url: string) => {
    setPhotoSearching(true);
    setTimeout(() => {
      setPhotoCandidates([
        {
          caseItem: cases[0],
          similarity: 0.94,
          disclaimer: 'Possible case match (human decision required)',
        },
        {
          caseItem: cases[1],
          similarity: 0.72,
          disclaimer: 'Possible case match (human decision required)',
        },
      ]);
      setPhotoSearching(false);
    }, 700);
  };

  // Content body for both Dialog (Global) and Popover (Inline)
  const renderContent = () => (
    <div className="flex flex-col max-h-[520px]">
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-full">
        <div className="flex items-center justify-between border-b px-3 py-2 bg-muted/20">
          <TabsList className="h-7 bg-muted/60 p-0.5">
            <TabsTrigger value="text" className="h-6 text-xs px-2.5">
              <Search className="mr-1.5 h-3 w-3" />
              Database Search
            </TabsTrigger>
            <TabsTrigger value="photo" className="h-6 text-xs px-2.5">
              <Camera className="mr-1.5 h-3 w-3" />
              By Photo
            </TabsTrigger>
          </TabsList>

          {activeTab === 'text' && (
            <div className="flex items-center gap-1">
              {['all', 'critical', 'active', 'minor'].map((flt) => (
                <button
                  key={flt}
                  onClick={() => setSelectedFilter(flt)}
                  className={cn(
                    'rounded px-1.5 py-0.5 text-[10px] font-mono capitalize transition-colors',
                    selectedFilter === flt
                      ? 'bg-primary text-primary-foreground font-semibold'
                      : 'text-muted-foreground hover:bg-muted',
                  )}
                >
                  {flt}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tab 1: Text Search across people, cases, FIR, aliases */}
        <TabsContent value="text" className="m-0 p-0">
          <div className="p-2 border-b">
            <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-muted/40 border">
              <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={placeholder}
                className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
                autoFocus
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')}>
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>

          <div className="overflow-y-auto max-h-[360px] p-2 space-y-3">
            {filteredCases.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No matching persons or cases found.
              </div>
            ) : (
              <>
                {/* Recent Section */}
                {!searchQuery && recentCases.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-2">
                      Recent Cases
                    </span>
                    {recentCases.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => handleSelectCaseInternal(c)}
                        className="flex items-center justify-between p-2 rounded-md hover:bg-secondary/60 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Avatar className="h-7 w-7 border shrink-0">
                            <AvatarImage src={c.referencePhotos?.[0]?.url} alt={c.personName} />
                            <AvatarFallback>{c.personName.slice(0, 2)}</AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col truncate">
                            <span className="text-xs font-semibold text-foreground truncate">
                              {c.personName}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {c.caseNumber} • {c.lastSeenLocation.split(',')[0]}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <StatusChip status={c.status} size="sm" />
                          <PriorityChip priority={c.priority} size="sm" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* All Matches */}
                <div className="space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-2">
                    {searchQuery ? 'Search Matches' : 'All Cases'}
                  </span>
                  {filteredCases.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => handleSelectCaseInternal(c)}
                      className="flex items-center justify-between p-2 rounded-md hover:bg-secondary/60 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar className="h-7 w-7 border shrink-0">
                          <AvatarImage src={c.referencePhotos?.[0]?.url} alt={c.personName} />
                          <AvatarFallback>{c.personName.slice(0, 2)}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col truncate">
                          <span className="text-xs font-semibold text-foreground truncate">
                            {c.personName}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono truncate">
                            {c.caseNumber} • {c.lastSeenLocation}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <StatusChip status={c.status} size="sm" />
                        <PriorityChip priority={c.priority} size="sm" />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Quick Navigation Commands (When Global) */}
            {!isInlinePicker && !searchQuery && (
              <div className="border-t pt-2 space-y-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-2">
                  Quick Actions
                </span>
                <div
                  onClick={() => {
                    setCmdKOpen(false);
                    router.push('/cases/new');
                  }}
                  className="flex items-center gap-2 p-2 rounded-md hover:bg-secondary/60 cursor-pointer text-xs font-medium"
                >
                  <UserPlus className="h-3.5 w-3.5 text-primary" />
                  <span>Register New Missing Person</span>
                </div>
                <div
                  onClick={() => {
                    setCmdKOpen(false);
                    router.push('/review');
                  }}
                  className="flex items-center gap-2 p-2 rounded-md hover:bg-secondary/60 cursor-pointer text-xs font-medium"
                >
                  <Eye className="h-3.5 w-3.5 text-amber-500" />
                  <span>Open Verification Review Queue</span>
                </div>
                <div
                  onClick={() => {
                    setCmdKOpen(false);
                    router.push('/journeys');
                  }}
                  className="flex items-center gap-2 p-2 rounded-md hover:bg-secondary/60 cursor-pointer text-xs font-medium"
                >
                  <GitFork className="h-3.5 w-3.5 text-blue-500" />
                  <span>Cross-Camera Tracking Journeys</span>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab 2: Photo Search (Drop / Paste) */}
        <TabsContent value="photo" className="m-0 p-4 space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) {
                const url = URL.createObjectURL(file);
                setUploadedPhotoUrl(url);
                runPhotoSearch(url);
              }
            }}
            className={cn(
              'flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-colors',
              isDragging ? 'border-primary bg-primary/5' : 'border-border bg-muted/20',
            )}
          >
            <Upload className="h-8 w-8 text-muted-foreground mb-2" />
            <span className="text-xs font-medium text-foreground">
              Drop photo here, paste from clipboard, or browse
            </span>
            <span className="text-[10px] text-muted-foreground mt-1">
              Extracts 512-d ArcFace & OSNet embeddings to rank possible existing cases
            </span>
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="mt-3 text-xs file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:bg-primary file:text-primary-foreground cursor-pointer"
            />
          </div>

          {photoSearching && (
            <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
              <Sparkles className="h-4 w-4 animate-spin text-primary" />
              Searching vector database for matching reference sets...
            </div>
          )}

          {photoCandidates.length > 0 && !photoSearching && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                  Possible Case Matches (Human Decision Required)
                </span>
                <span className="text-[10px] text-amber-500 font-mono">Never auto-confirmed</span>
              </div>

              <div className="space-y-1.5">
                {photoCandidates.map((cand) => (
                  <div
                    key={cand.caseItem.id}
                    onClick={() => handleSelectCaseInternal(cand.caseItem)}
                    className="flex items-center justify-between p-2.5 rounded-lg border bg-card hover:bg-secondary/50 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8 border">
                        <AvatarImage src={cand.caseItem.referencePhotos?.[0]?.url} />
                        <AvatarFallback>{cand.caseItem.personName.slice(0, 2)}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold">{cand.caseItem.personName}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {cand.caseItem.caseNumber} • Score: {Math.round(cand.similarity * 100)}%
                        </span>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="h-7 text-xs">
                      Select Case
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );

  // If used as an Inline Person Picker
  if (isInlinePicker) {
    const activeCase = cases.find((c) => c.id === selectedCaseId);
    return (
      <Popover open={inlineOpen} onOpenChange={setInlineOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn('h-9 justify-between text-xs font-normal gap-2', className)}
          >
            <div className="flex items-center gap-2 truncate">
              <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="truncate">
                {activeCase ? `${activeCase.personName} (${activeCase.caseNumber})` : placeholder}
              </span>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[380px] p-0 shadow-lg">
          {renderContent()}
        </PopoverContent>
      </Popover>
    );
  }

  // Global Cmd+K Dialog
  return (
    <CommandDialog open={cmdKOpen} onOpenChange={setCmdKOpen}>
      {renderContent()}
    </CommandDialog>
  );
}
