'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { MissingPerson, MissingPersonPriority, MissingPersonStatus } from '@/types/missing-person';
import { missingPersonService } from '@/services/missing-person.service';
import {
  ReferencePhotoManager,
  ReachableAreaMap,
  StatusChangeDialog,
  NewLastSeenDialog,
  HistoryTimeline,
  HardNegativesList,
} from '@/components/features/missing-persons';
import {
  User,
  ShieldAlert,
  ShieldX,
  MapPin,
  Camera,
  History,
  Edit,
  Navigation,
  ShieldCheck,
  Search,
  Clock,
  Sparkles,
  Phone,
  FileCheck2,
  Lock,
  ArrowLeft,
  Calendar,
} from 'lucide-react';

export default function MissingPersonDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [person, setPerson] = useState<MissingPerson | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [updateNotice, setUpdateNotice] = useState<string | null>(null);

  // Quick action dialog states
  const [isLastSeenDialogOpen, setIsLastSeenDialogOpen] = useState(false);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);

  const fetchDossier = async () => {
    setIsLoading(true);
    try {
      const data = await missingPersonService.getById(id);
      if (data) setPerson(data);
    } catch (err) {
      console.error('Failed to load dossier:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDossier();
  }, [id]);

  if (isLoading) {
    return <div className="p-12 text-center text-xs text-muted-foreground">Loading missing person dossier...</div>;
  }

  if (!person) {
    return (
      <div className="p-12 text-center space-y-4">
        <p className="text-sm font-semibold">Missing person dossier not found.</p>
        <Link href="/missing-persons">
          <Button size="sm" variant="outline">
            Return to Directory
          </Button>
        </Link>
      </div>
    );
  }

  const avatarUrl =
    person.personId === 'mp_2026_001'
      ? 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80'
      : person.personId === 'mp_2026_002'
      ? 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=400&q=80'
      : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80';

  const getPriorityBadge = (priority: MissingPersonPriority) => {
    switch (priority) {
      case 'critical':
        return <Badge className="bg-red-600 hover:bg-red-700 text-white font-mono uppercase text-xs">Critical Priority</Badge>;
      case 'high':
        return <Badge className="bg-amber-600 hover:bg-amber-700 text-white font-mono uppercase text-xs">High Priority</Badge>;
      case 'medium':
        return <Badge variant="secondary" className="font-mono uppercase text-xs">Medium Priority</Badge>;
      default:
        return <Badge variant="outline" className="font-mono uppercase text-xs">Low Priority</Badge>;
    }
  };

  const getStatusBadge = (status: MissingPersonStatus) => {
    switch (status) {
      case 'active':
        return <Badge variant="outline" className="border-emerald-500 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">Active AI Search</Badge>;
      case 'under_verification':
        return <Badge variant="outline" className="border-amber-500 text-amber-500 text-xs font-semibold">Under Verification</Badge>;
      case 'found':
        return <Badge className="bg-emerald-600 text-white text-xs font-semibold">Found / Closed</Badge>;
      case 'closed':
        return <Badge variant="secondary" className="text-xs">Closed</Badge>;
      default:
        return <Badge variant="outline" className="text-xs capitalize">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Breadcrumb & Navigation */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link href="/missing-persons" className="hover:text-foreground flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" /> Missing Persons
        </Link>
        <span>/</span>
        <span className="font-mono font-semibold text-foreground">{person.authority.reportNumber}</span>
      </div>

      {/* Hero Dossier Banner */}
      <Card className="border overflow-hidden bg-card">
        <div className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <Avatar className="h-20 w-20 rounded-xl border-2 border-primary/20 shadow-md">
              <AvatarImage src={avatarUrl} alt={person.identity.fullName} className="object-cover" />
              <AvatarFallback className="rounded-xl font-bold text-lg">
                {person.identity.fullName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-black tracking-tight text-foreground">
                  {person.identity.fullName}
                </h1>
                {person.vulnerability.isMinor && (
                  <Badge variant="outline" className="border-red-500 text-red-500 text-[10px]">
                    Minor
                  </Badge>
                )}
                {person.vulnerability.mentalHealthFlag && (
                  <Badge variant="outline" className="border-amber-500 text-amber-500 text-[10px]">
                    Silver Alert
                  </Badge>
                )}
                {getPriorityBadge(person.priority)}
                {getStatusBadge(person.status)}
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <span className="font-mono">{person.authority.reportNumber}</span>
                <span>•</span>
                <span>{person.identity.gender} · {person.identity.approxAgeRange.min} yrs · {person.physical.heightCm || 160} cm</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-destructive" />
                  {person.lastSeen.locationText}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions Header Toolbar */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsLastSeenDialogOpen(true)}
              className="h-8 text-xs gap-1.5"
            >
              <Navigation className="h-3.5 w-3.5" /> Update Sighting
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsStatusDialogOpen(true)}
              className="h-8 text-xs gap-1.5"
            >
              <ShieldCheck className="h-3.5 w-3.5" /> Change Status
            </Button>
            <Link href={`/missing-persons/${person.personId}/edit`}>
              <Button size="sm" variant="secondary" className="h-8 text-xs gap-1.5">
                <Edit className="h-3.5 w-3.5" /> Edit Dossier
              </Button>
            </Link>
            <Link href={`/search?caseId=${person.caseId}`}>
              <Button size="sm" className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground font-semibold">
                <Search className="h-3.5 w-3.5" /> Search Stream
              </Button>
            </Link>
          </div>
        </div>
      </Card>

      {/* Dynamic Sighting / Search Notification */}
      {updateNotice && (
        <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-between text-xs animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 shrink-0 text-emerald-500" />
            <span className="font-medium">{updateNotice}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setUpdateNotice(null)}
            className="h-6 px-2 text-[11px] hover:bg-emerald-500/20"
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-2 sm:grid-cols-5 h-auto p-1 bg-muted/60">
          <TabsTrigger value="overview" className="text-xs py-2 gap-1.5">
            <User className="h-3.5 w-3.5" /> Overview & Bio
          </TabsTrigger>
          <TabsTrigger value="references" className="text-xs py-2 gap-1.5">
            <Camera className="h-3.5 w-3.5" /> Reference Gallery
          </TabsTrigger>
          <TabsTrigger value="lastseen" className="text-xs py-2 gap-1.5">
            <MapPin className="h-3.5 w-3.5" /> Last Seen & Perimeter
          </TabsTrigger>
          <TabsTrigger value="negatives" className="text-xs py-2 gap-1.5">
            <ShieldX className="h-3.5 w-3.5 text-destructive" /> Hard Negatives
          </TabsTrigger>
          <TabsTrigger value="history" className="text-xs py-2 gap-1.5">
            <History className="h-3.5 w-3.5" /> Audit History
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Overview */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Physical Attributes */}
            <Card className="border">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                  <User className="h-4 w-4 text-primary" /> Physical Attributes & Marks
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-2 space-y-2.5 text-xs">
                <div className="grid grid-cols-2 gap-2 p-2.5 rounded bg-muted/20 border">
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-bold">Build:</span>
                    <span className="font-semibold">{person.physical.build}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-bold">Height:</span>
                    <span className="font-semibold">{person.physical.heightCm ? `${person.physical.heightCm} cm` : 'Approximate'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-bold">Hair:</span>
                    <span className="font-semibold">{person.physical.hair}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-bold">Eyes:</span>
                    <span className="font-semibold">{person.physical.eyes}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-muted-foreground font-semibold">Distinguishing Marks:</span>
                  <div className="p-2 rounded bg-muted/10 border text-foreground">
                    {person.physical.distinguishingMarks.length > 0
                      ? person.physical.distinguishingMarks.join('; ')
                      : 'None reported.'}
                  </div>
                </div>

                {person.vulnerability.medicalNotesEncrypted && (
                  <div className="p-2.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 space-y-1">
                    <div className="font-bold flex items-center gap-1 text-[11px]">
                      <Lock className="h-3.5 w-3.5" /> Confidential Medical Note (Field Encrypted):
                    </div>
                    <p className="text-[11px]">{person.vulnerability.medicalNotesEncrypted}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Clothing & Footwear */}
            <Card className="border">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                  <FileCheck2 className="h-4 w-4 text-primary" /> Clothing & Personal Items
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-2 space-y-3 text-xs">
                <div className="space-y-1.5">
                  <span className="text-muted-foreground font-semibold">Reported Clothing Articles:</span>
                  <div className="flex flex-wrap gap-2">
                    {person.lastSeenClothing.items.map((item, idx) => (
                      <div key={idx} className="p-2 rounded bg-muted/30 border text-xs font-medium">
                        <span className="font-bold text-primary">{item.type}:</span> {item.colour} ({item.pattern || 'Plain'})
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-muted-foreground font-semibold">Footwear:</span>
                  <div className="p-2 rounded bg-muted/10 border">
                    {person.lastSeenClothing.footwear || 'Standard footwear'}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-muted-foreground font-semibold">Carried Items & Accessories:</span>
                  <div className="p-2 rounded bg-muted/10 border">
                    {person.lastSeenClothing.carriedItems.length > 0
                      ? person.lastSeenClothing.carriedItems.join(', ')
                      : 'None observed'}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Statutory Authority & Reporter */}
            <Card className="border md:col-span-2">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-primary" /> Statutory Authority & Reporting Party
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-2 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-3 rounded bg-muted/20 border space-y-1">
                  <span className="text-muted-foreground text-[10px] uppercase font-bold block">
                    Statutory Jurisdiction & Legal Basis:
                  </span>
                  <div className="font-bold text-foreground">{person.authority.station}</div>
                  <div className="text-muted-foreground">Officer: {person.authority.officerName}</div>
                  <div className="text-muted-foreground text-[11px] pt-1">
                    {person.authority.legalBasisNote}
                  </div>
                </div>

                <div className="p-3 rounded bg-muted/20 border space-y-1">
                  <span className="text-muted-foreground text-[10px] uppercase font-bold block">
                    Reporting Family / Guardian Contact:
                  </span>
                  <div className="font-bold text-foreground">{person.reporter.name} ({person.reporter.relation})</div>
                  <div className="text-muted-foreground flex items-center gap-1 font-mono">
                    <Phone className="h-3 w-3" /> {person.reporter.phoneEncrypted || 'Protected'}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 2: References Gallery */}
        <TabsContent value="references" className="space-y-4">
          <Card className="border">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-bold">Biometric Gallery & Continuous Re-Indexing</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              <ReferencePhotoManager caseId={person.caseId} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Last Seen & Map */}
        <TabsContent value="lastseen" className="space-y-4">
          <Card className="border">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-bold">Last Observed Location & Perimeter</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-4">
              <ReachableAreaMap
                coordinates={person.lastSeen.coordinates.coordinates}
                onCoordinatesChange={() => {}}
                lastSeenTs={person.lastSeen.ts}
              />

              <div className="p-3 rounded bg-muted/20 border text-xs space-y-1">
                <div className="font-bold text-foreground">Circumstances:</div>
                <p className="text-muted-foreground">{person.lastSeen.circumstances || 'No additional narrative provided.'}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Hard Negatives Suppression */}
        <TabsContent value="negatives" className="space-y-4">
          <HardNegativesList caseId={person.caseId} />
        </TabsContent>

        {/* Tab 5: History */}
        <TabsContent value="history" className="space-y-4">
          <HistoryTimeline history={person.history} />
        </TabsContent>
      </Tabs>

      {/* Quick Action: New Sighting Dialog */}
      {isLastSeenDialogOpen && (
        <NewLastSeenDialog
          isOpen={isLastSeenDialogOpen}
          onClose={() => setIsLastSeenDialogOpen(false)}
          personId={person.personId}
          initialCoords={person.lastSeen.coordinates.coordinates}
          onSubmitUpdate={async (data) => {
            await missingPersonService.addLastSeen(person.personId, data);
            await fetchDossier();
            setActiveTab('lastseen');
            setUpdateNotice(
              data.triggerSearch
                ? `Recomputed reachable perimeter from ${data.locationText}. Launched prioritized vision search across nearby camera surveillance nodes.`
                : `Recomputed reachable perimeter from ${data.locationText}.`,
            );
            setTimeout(() => setUpdateNotice(null), 7000);
          }}
        />
      )}

      {/* Quick Action: Status Change Dialog */}
      {isStatusDialogOpen && (
        <StatusChangeDialog
          isOpen={isStatusDialogOpen}
          onClose={() => setIsStatusDialogOpen(false)}
          currentStatus={person.status}
          onConfirmStatus={async (data) => {
            await missingPersonService.updateStatus(person.personId, data);
            fetchDossier();
          }}
        />
      )}
    </div>
  );
}
