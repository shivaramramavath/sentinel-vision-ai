'use client';

import React, { useState, useEffect, useTransition, useCallback } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { missingPersonService } from '@/services/missing-person.service';
import { PersonSearchResult, PhotoSearchCandidate } from '@/types/tracking';
import {
  Search,
  Camera,
  UploadCloud,
  Clock,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  History,
  Sparkles,
  Command as CommandIcon,
  X,
  Footprints,
  Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PersonSearchProps {
  selectedPerson?: PersonSearchResult | null;
  onSelectPerson: (person: PersonSearchResult) => void;
}

const RECENT_CASES_KEY = 'sentinel_tracking_recent_cases_v1';

export function PersonSearch({ selectedPerson, onSelectPerson }: PersonSearchProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'text' | 'photo'>('text');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'under_verification' | 'closed' | 'high_priority'>('all');
  const [results, setResults] = useState<PersonSearchResult[]>([]);
  const [recentCases, setRecentCases] = useState<PersonSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [photoCandidates, setPhotoCandidates] = useState<PhotoSearchCandidate[]>([]);
  const [isPhotoLoading, setIsPhotoLoading] = useState(false);
  const [uploadedPreview, setUploadedPreview] = useState<string | null>(null);

  // Load recent cases from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(RECENT_CASES_KEY);
        if (stored) {
          setRecentCases(JSON.parse(stored));
        }
      } catch {
        // ignore
      }
    }
  }, []);

  // Global Ctrl+K / Cmd+K shortcut listener on this page
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Debounced text search
  useEffect(() => {
    let isCancelled = false;
    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const priorityParam = statusFilter === 'high_priority' ? 'high' : undefined;
        const statusParam = statusFilter !== 'all' && statusFilter !== 'high_priority' ? statusFilter : undefined;

        const data = await missingPersonService.searchDossiers({
          q: query,
          status: statusParam,
          priority: priorityParam,
          limit: 25,
        });
        if (!isCancelled) {
          setResults(data);
        }
      } catch {
        // fallback
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    }, 250);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [query, statusFilter]);

  const handleSelect = (person: PersonSearchResult) => {
    // Save to recents (max 5)
    setRecentCases((prev) => {
      const filtered = prev.filter((p) => p.caseId !== person.caseId);
      const next = [person, ...filtered].slice(0, 5);
      try {
        localStorage.setItem(RECENT_CASES_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });

    onSelectPerson(person);
    setOpen(false);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setUploadedPreview(dataUrl);
      setIsPhotoLoading(true);
      try {
        const res = await missingPersonService.searchByPhoto(dataUrl);
        setPhotoCandidates(res.candidates || []);
      } catch {
        // ignore
      } finally {
        setIsPhotoLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Matched text highlighter helper
  const highlightMatch = (text: string, q: string) => {
    if (!q.trim()) return text;
    const parts = text.split(new RegExp(`(${q.trim()})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) =>
          part.toLowerCase() === q.toLowerCase() ? (
            <mark key={i} className="bg-cyan-500/30 text-cyan-200 rounded px-0.5 font-bold">
              {part}
            </mark>
          ) : (
            part
          ),
        )}
      </span>
    );
  };

  const activeJourneys = results.filter((r) => r.hopsCount > 0 && r.status === 'active');

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 px-3 gap-2.5 font-normal text-xs justify-between min-w-[280px] max-w-[360px] bg-background/80 hover:bg-muted border-border/80 shadow-xs"
        >
          <div className="flex items-center gap-2 truncate">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            {selectedPerson ? (
              <span className="font-semibold text-foreground truncate">
                {selectedPerson.fullName} ({selectedPerson.caseNumber})
              </span>
            ) : (
              <span className="text-muted-foreground truncate">
                Search missing person or case...
              </span>
            )}
          </div>
          <kbd className="pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground shrink-0">
            <span className="text-xs">⌘</span>K
          </kbd>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-[480px] p-0 shadow-2xl border-border bg-card overflow-hidden"
      >
        <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-full">
          <div className="border-b bg-muted/40 px-3 pt-2 pb-1.5 flex items-center justify-between">
            <TabsList className="h-7 bg-muted/60 p-0.5">
              <TabsTrigger value="text" className="text-xs h-6 px-2.5 gap-1.5">
                <Search className="h-3 w-3" /> Person Search
              </TabsTrigger>
              <TabsTrigger value="photo" className="text-xs h-6 px-2.5 gap-1.5">
                <Camera className="h-3 w-3" /> Search by Photo
              </TabsTrigger>
            </TabsList>
            <span className="text-[10px] text-muted-foreground font-mono">
              ESC to close
            </span>
          </div>

          {/* TAB 1: TEXT SEARCH WITH COMMAND */}
          <TabsContent value="text" className="m-0 focus-visible:outline-none">
            {/* Filter Chips Bar */}
            <div className="flex items-center gap-1.5 px-3 py-2 border-b bg-muted/20 overflow-x-auto text-xs">
              <span className="text-[10px] uppercase font-mono text-muted-foreground shrink-0 mr-1">
                Filter:
              </span>
              {[
                { id: 'all', label: 'All Cases' },
                { id: 'active', label: 'Active' },
                { id: 'under_verification', label: 'Under Verification' },
                { id: 'high_priority', label: 'High Priority' },
                { id: 'closed', label: 'Closed' },
              ].map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setStatusFilter(filter.id as any)}
                  className={cn(
                    'px-2 py-0.5 rounded text-[10px] font-medium transition-colors shrink-0',
                    statusFilter === filter.id
                      ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                      : 'bg-muted/60 hover:bg-muted text-muted-foreground',
                  )}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            <Command className="rounded-none border-none bg-transparent">
              <CommandInput
                placeholder="Type name, alias, case ID (e.g. MP-2026-0891), place..."
                value={query}
                onValueChange={setQuery}
                className="h-10 text-xs border-b"
              />

              <CommandList className="max-h-[360px] overflow-y-auto p-1.5 space-y-1">
                {isLoading && (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    Searching missing persons registry...
                  </div>
                )}

                {!isLoading && results.length === 0 && (
                  <CommandEmpty className="py-6 text-center text-xs text-muted-foreground">
                    No matching missing persons or cases found.
                  </CommandEmpty>
                )}

                {/* GROUP 1: RECENT CASES */}
                {!query && recentCases.length > 0 && (
                  <CommandGroup
                    heading={
                      <span className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-muted-foreground">
                        <History className="h-3 w-3" /> Recent Searches
                      </span>
                    }
                  >
                    {recentCases.map((person) => (
                      <CommandItem
                        key={`recent_${person.caseId}`}
                        value={`recent_${person.fullName}_${person.caseNumber}`}
                        onSelect={() => handleSelect(person)}
                        className="flex items-center justify-between p-2 rounded-md hover:bg-muted cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Avatar className="h-8 w-8 rounded border shrink-0">
                            <AvatarImage src={person.avatarUrl} alt={person.fullName} />
                            <AvatarFallback>{person.fullName.slice(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="font-semibold text-xs text-foreground truncate">
                              {person.fullName}
                            </div>
                            <div className="text-[10px] text-muted-foreground flex items-center gap-2 font-mono mt-0.5">
                              <span>{person.caseNumber}</span>
                              <span>•</span>
                              <span>{person.hopsCount} hops</span>
                            </div>
                          </div>
                        </div>
                        <Badge
                          variant={person.priority === 'critical' ? 'destructive' : 'outline'}
                          className="text-[9px] font-mono uppercase"
                        >
                          {person.priority}
                        </Badge>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}

                {/* GROUP 2: ACTIVE TRACKING JOURNEYS */}
                {!query && activeJourneys.length > 0 && (
                  <CommandGroup
                    heading={
                      <span className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-cyan-400">
                        <Footprints className="h-3 w-3" /> Active Tracking Journeys
                      </span>
                    }
                  >
                    {activeJourneys.map((person) => (
                      <CommandItem
                        key={`active_${person.caseId}`}
                        value={`active_${person.fullName}_${person.caseNumber}`}
                        onSelect={() => handleSelect(person)}
                        className="flex items-center justify-between p-2 rounded-md hover:bg-muted cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Avatar className="h-8 w-8 rounded border border-cyan-500/40 shrink-0">
                            <AvatarImage src={person.avatarUrl} alt={person.fullName} />
                            <AvatarFallback>{person.fullName.slice(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="font-semibold text-xs text-foreground truncate">
                              {person.fullName}
                            </div>
                            <div className="text-[10px] text-muted-foreground flex items-center gap-2 font-mono mt-0.5">
                              <span className="text-cyan-400 font-bold">{person.hopsCount} hops tracked</span>
                              <span>•</span>
                              <span className="truncate">{person.lastSeenLocation}</span>
                            </div>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[9px] font-mono text-emerald-400 border-emerald-500/40">
                          ACTIVE
                        </Badge>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}

                {/* GROUP 3: ALL MATCHES */}
                {results.length > 0 && (
                  <CommandGroup
                    heading={
                      <span className="text-[10px] font-mono uppercase text-muted-foreground">
                        All Matching Cases ({results.length})
                      </span>
                    }
                  >
                    {results.map((person) => (
                      <CommandItem
                        key={person.caseId}
                        value={`${person.fullName} ${person.caseNumber} ${person.lastSeenLocation}`}
                        onSelect={() => handleSelect(person)}
                        className="flex items-center justify-between p-2 rounded-md hover:bg-muted cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <Avatar className="h-8 w-8 rounded border shrink-0">
                            <AvatarImage src={person.avatarUrl} alt={person.fullName} />
                            <AvatarFallback>{person.fullName.slice(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-xs text-foreground truncate">
                              {highlightMatch(person.fullName, query)}
                            </div>
                            <div className="text-[10px] text-muted-foreground flex items-center gap-2 font-mono mt-0.5 truncate">
                              <span>{highlightMatch(person.caseNumber, query)}</span>
                              <span>•</span>
                              <span>{person.hopsCount} hops</span>
                              <span>•</span>
                              <span className="truncate">{highlightMatch(person.lastSeenLocation || '', query)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 pl-2">
                          <Badge
                            variant={
                              person.status === 'active'
                                ? 'default'
                                : person.status === 'under_verification'
                                ? 'secondary'
                                : 'outline'
                            }
                            className="text-[9px] font-mono uppercase font-bold"
                          >
                            {person.status}
                          </Badge>
                          <Badge
                            variant={person.priority === 'critical' ? 'destructive' : 'outline'}
                            className="text-[9px] font-mono uppercase"
                          >
                            {person.priority}
                          </Badge>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </TabsContent>

          {/* TAB 2: SEARCH BY PHOTO */}
          <TabsContent value="photo" className="m-0 p-3 space-y-3 focus-visible:outline-none">
            <div className="rounded-lg border-2 border-dashed border-border/80 p-4 text-center hover:bg-muted/20 transition-colors relative">
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <div className="flex flex-col items-center justify-center gap-1.5">
                <UploadCloud className="h-7 w-7 text-muted-foreground" />
                <div className="text-xs font-semibold text-foreground">
                  Drag & drop or paste subject photo
                </div>
                <div className="text-[10px] text-muted-foreground">
                  InsightFace & OSNet visual matcher ranks registered cases.
                </div>
              </div>
            </div>

            {uploadedPreview && (
              <div className="flex items-center gap-2.5 p-2 rounded bg-muted/40 border text-xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={uploadedPreview}
                  alt="Uploaded target"
                  className="h-10 w-10 rounded object-cover border shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-foreground text-xs truncate">
                    Uploaded Subject Query Photo
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono">
                    Searching ArcFace face + OSNet Re-ID embedding index...
                  </div>
                </div>
              </div>
            )}

            {isPhotoLoading && (
              <div className="py-6 text-center text-xs text-muted-foreground">
                Comparing visual embeddings across active missing person dossiers...
              </div>
            )}

            {!isPhotoLoading && photoCandidates.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-semibold text-foreground px-0.5">
                  <span>Possible case matches (human decision required)</span>
                  <span className="text-[10px] text-amber-500 font-mono">
                    Never auto-confirmed
                  </span>
                </div>

                <div className="space-y-1.5 max-h-[220px] overflow-y-auto">
                  {photoCandidates.map((candidate) => (
                    <div
                      key={candidate.caseId}
                      className="p-2 rounded border bg-card hover:border-cyan-500/50 transition-colors flex items-center justify-between gap-2.5"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Side by side preview */}
                        <div className="flex items-center -space-x-2 shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={candidate.matchedPhotoUrl}
                            alt="Dossier photo"
                            className="h-9 w-9 rounded-full object-cover border-2 border-background"
                            title="Reference photo in dossier"
                          />
                        </div>

                        <div className="min-w-0">
                          <div className="font-semibold text-xs text-foreground truncate">
                            {candidate.personName}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono truncate">
                            {candidate.caseNumber} • Match: {Math.round(candidate.similarityScore * 100)}%
                          </div>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          const matchingPerson: PersonSearchResult = {
                            caseId: candidate.caseId,
                            caseNumber: candidate.caseNumber,
                            fullName: candidate.personName,
                            aliases: [],
                            avatarUrl: candidate.matchedPhotoUrl,
                            priority: candidate.priority as any,
                            status: candidate.status as any,
                            hopsCount: 4,
                            lastSeenLocation: candidate.lastSeenLocation,
                          };
                          handleSelect(matchingPerson);
                        }}
                        className="h-7 px-2 text-[11px] font-medium shrink-0"
                      >
                        <Eye className="h-3 w-3 mr-1" /> Select Case
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
