'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MissingPerson, ReferenceImageUI } from '@/types/missing-person';
import { missingPersonService } from '@/services/missing-person.service';
import {
  ReferencePhotoManager,
  ReachableAreaMap,
  DiffConflictDialog,
  StatusChangeDialog,
  NewLastSeenDialog,
  HistoryTimeline,
} from '@/components/features/missing-persons';
import {
  User,
  ShieldAlert,
  MapPin,
  Shirt,
  Camera,
  FileCheck2,
  History,
  Save,
  Navigation,
  ShieldCheck,
  ArrowLeft,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

export default function EditMissingPersonPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [person, setPerson] = useState<MissingPerson | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('identity');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<string | null>(null);

  // Optimistic concurrency & Conflict Dialog State
  const [conflictData, setConflictData] = useState<{
    local: Record<string, any>;
    server: Record<string, any>;
  } | null>(null);

  // Quick action dialog states
  const [isLastSeenDialogOpen, setIsLastSeenDialogOpen] = useState(false);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);

  // Local Form editable states
  const [fullName, setFullName] = useState('');
  const [aliases, setAliases] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other' | 'unknown'>('unknown');
  const [approxAgeMin, setApproxAgeMin] = useState(18);
  const [approxAgeMax, setApproxAgeMax] = useState(60);
  const [heightCm, setHeightCm] = useState<number | undefined>(160);
  const [build, setBuild] = useState('medium');
  const [hair, setHair] = useState('black');
  const [eyes, setEyes] = useState('brown');
  const [distinguishingMarks, setDistinguishingMarks] = useState('');
  const [glasses, setGlasses] = useState(false);
  const [beard, setBeard] = useState(false);

  // Vulnerability
  const [isMinor, setIsMinor] = useState(false);
  const [mentalHealthFlag, setMentalHealthFlag] = useState(false);
  const [requiresUrgentPriority, setRequiresUrgentPriority] = useState(false);
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('high');

  // Last Seen
  const [lastSeenLocationText, setLastSeenLocationText] = useState('');
  const [lastSeenTs, setLastSeenTs] = useState('');
  const [coordinates, setCoordinates] = useState<[number, number]>([103.85, 1.29]);
  const [direction, setDirection] = useState('');
  const [circumstances, setCircumstances] = useState('');

  // Clothing
  const [footwear, setFootwear] = useState('');
  const [carriedItems, setCarriedItems] = useState('');

  const fetchDossier = async () => {
    setIsLoading(true);
    try {
      const data = await missingPersonService.getById(id);
      if (data) {
        setPerson(data);
        // Populate form
        setFullName(data.identity.fullName);
        setAliases(data.identity.aliases.join(', '));
        setGender(data.identity.gender);
        setApproxAgeMin(data.identity.approxAgeRange.min);
        setApproxAgeMax(data.identity.approxAgeRange.max);
        setHeightCm(data.physical.heightCm);
        setBuild(data.physical.build);
        setHair(data.physical.hair);
        setEyes(data.physical.eyes);
        setDistinguishingMarks(data.physical.distinguishingMarks.join(', '));
        setGlasses(data.physical.glasses);
        setBeard(data.physical.beard);

        setIsMinor(data.vulnerability.isMinor);
        setMentalHealthFlag(data.vulnerability.mentalHealthFlag);
        setRequiresUrgentPriority(data.vulnerability.requiresUrgentPriority);
        setPriority(data.priority);

        setLastSeenLocationText(data.lastSeen.locationText);
        setLastSeenTs(data.lastSeen.ts.slice(0, 16));
        setCoordinates(data.lastSeen.coordinates.coordinates);
        setDirection(data.lastSeen.direction || '');
        setCircumstances(data.lastSeen.circumstances || '');

        setFootwear(data.lastSeenClothing.footwear || '');
        setCarriedItems(data.lastSeenClothing.carriedItems.join(', '));
      }
    } catch (err) {
      console.error('Failed to load missing person dossier:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDossier();
  }, [id]);

  // Patch with Optimistic Concurrency Control (If-Match)
  const handleSaveChanges = async (forceOverwrite = false) => {
    if (!person) return;
    setIsSaving(true);
    setSaveSuccessNotice(null);

    const patchPayload: Partial<MissingPerson> = {
      identity: {
        ...person.identity,
        fullName,
        aliases: aliases ? aliases.split(',').map((s) => s.trim()) : [],
        gender,
        approxAgeRange: { min: approxAgeMin, max: approxAgeMax },
      },
      physical: {
        ...person.physical,
        heightCm,
        build,
        hair,
        eyes,
        distinguishingMarks: distinguishingMarks
          ? distinguishingMarks.split(',').map((s) => s.trim())
          : [],
        glasses,
        beard,
      },
      vulnerability: {
        ...person.vulnerability,
        isMinor,
        mentalHealthFlag,
        requiresUrgentPriority,
      },
      priority,
      lastSeen: {
        ...person.lastSeen,
        locationText: lastSeenLocationText,
        ts: new Date(lastSeenTs).toISOString(),
        coordinates: { type: 'Point', coordinates },
        direction,
        circumstances,
      },
      lastSeenClothing: {
        ...person.lastSeenClothing,
        footwear,
        carriedItems: carriedItems ? carriedItems.split(',').map((s) => s.trim()) : [],
      },
    };

    try {
      const ifMatchVersion = forceOverwrite ? undefined : person.version;
      const updated = await missingPersonService.patch(person.personId, patchPayload, ifMatchVersion);
      setPerson(updated);
      setSaveSuccessNotice(`Successfully saved changes (v${updated.version})`);
      setTimeout(() => setSaveSuccessNotice(null), 3000);
    } catch (err: any) {
      if (err?.response?.status === 409) {
        // Trigger 409 Diff Conflict Dialog
        setConflictData({
          local: patchPayload,
          server: err.response.data?.serverDocument || person,
        });
      } else {
        alert(`Save failed: ${err?.message || 'Server error'}`);
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="p-12 text-center text-xs text-muted-foreground">Loading dossier editor...</div>;
  }

  if (!person) {
    return (
      <div className="p-12 text-center space-y-4">
        <p className="text-sm font-semibold">Missing person dossier not found.</p>
        <Link href="/missing-persons">
          <Button size="sm" variant="outline">
            Return to List
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link href={`/missing-persons/${person.personId}`}>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1">
                <ArrowLeft className="h-3 w-3" /> View Dossier
              </Button>
            </Link>
            <span className="text-xs text-muted-foreground">/</span>
            <span className="text-xs font-mono font-semibold text-muted-foreground">
              Editing {person.authority.reportNumber}
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
            {person.identity.fullName}
            <Badge variant="outline" className="font-mono text-xs">
              Version {person.version}
            </Badge>
          </h1>
        </div>

        {/* Quick Actions & Save Button */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsLastSeenDialogOpen(true)}
            className="h-8 text-xs gap-1"
          >
            <Navigation className="h-3.5 w-3.5" /> Add Sighting
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsStatusDialogOpen(true)}
            className="h-8 text-xs gap-1"
          >
            <ShieldCheck className="h-3.5 w-3.5" /> Change Status
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => handleSaveChanges(false)}
            disabled={isSaving}
            className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground font-semibold"
          >
            <Save className="h-3.5 w-3.5" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {saveSuccessNotice && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4 shrink-0" />
          <span>{saveSuccessNotice}</span>
        </div>
      )}

      {/* Main Tabs Layout */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-2 sm:grid-cols-5 h-auto p-1 bg-muted/60">
          <TabsTrigger value="identity" className="text-xs py-2 gap-1.5">
            <User className="h-3.5 w-3.5" /> Identity & Bio
          </TabsTrigger>
          <TabsTrigger value="vulnerability" className="text-xs py-2 gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5" /> Priority
          </TabsTrigger>
          <TabsTrigger value="lastseen" className="text-xs py-2 gap-1.5">
            <MapPin className="h-3.5 w-3.5" /> Last Seen & Map
          </TabsTrigger>
          <TabsTrigger value="references" className="text-xs py-2 gap-1.5">
            <Camera className="h-3.5 w-3.5" /> Photos Gallery
          </TabsTrigger>
          <TabsTrigger value="history" className="text-xs py-2 gap-1.5">
            <History className="h-3.5 w-3.5" /> Change History
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Identity */}
        <TabsContent value="identity" className="space-y-4">
          <Card className="border">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-bold">Biometric Identity & Physical Characteristics</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Full Name:</label>
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Aliases / Nicknames:</label>
                  <Input
                    value={aliases}
                    onChange={(e) => setAliases(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Gender:</label>
                  <Select value={gender} onValueChange={(val: any) => setGender(val)}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                      <SelectItem value="unknown">Unknown</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Approx Age Min:</label>
                  <Input
                    type="number"
                    value={approxAgeMin}
                    onChange={(e) => setApproxAgeMin(Number(e.target.value))}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Approx Age Max:</label>
                  <Input
                    type="number"
                    value={approxAgeMax}
                    onChange={(e) => setApproxAgeMax(Number(e.target.value))}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Height (cm):</label>
                  <Input
                    type="number"
                    value={heightCm || ''}
                    onChange={(e) => setHeightCm(Number(e.target.value))}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Build:</label>
                  <Input
                    value={build}
                    onChange={(e) => setBuild(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Hair:</label>
                  <Input
                    value={hair}
                    onChange={(e) => setHair(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Eyes:</label>
                  <Input
                    value={eyes}
                    onChange={(e) => setEyes(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Distinguishing Marks:</label>
                <Input
                  value={distinguishingMarks}
                  onChange={(e) => setDistinguishingMarks(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="flex gap-6 pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <Checkbox checked={glasses} onCheckedChange={(v) => setGlasses(Boolean(v))} />
                  <span>Wears Glasses</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <Checkbox checked={beard} onCheckedChange={(v) => setBeard(Boolean(v))} />
                  <span>Has Beard</span>
                </label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Vulnerability */}
        <TabsContent value="vulnerability" className="space-y-4">
          <Card className="border">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-bold">Vulnerability Risk Flags & Search Policy Priority</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded border bg-muted/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">Minor Status</span>
                    <Switch checked={isMinor} onCheckedChange={setIsMinor} />
                  </div>
                  <span className="text-[11px] text-muted-foreground">Subject is under 18 years of age.</span>
                </div>

                <div className="p-3 rounded border bg-muted/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">Mental Health / Dementia</span>
                    <Switch checked={mentalHealthFlag} onCheckedChange={setMentalHealthFlag} />
                  </div>
                  <span className="text-[11px] text-muted-foreground">Silver Alert vulnerability status.</span>
                </div>

                <div className="p-3 rounded border bg-muted/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">Urgent Priority</span>
                    <Switch checked={requiresUrgentPriority} onCheckedChange={setRequiresUrgentPriority} />
                  </div>
                  <span className="text-[11px] text-muted-foreground">High risk of imminent danger.</span>
                </div>
              </div>

              <div className="space-y-1.5 pt-2 border-t">
                <label className="text-xs font-semibold text-muted-foreground">Assigned Search Priority:</label>
                <Select value={priority} onValueChange={(val: any) => setPriority(val)}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critical">Critical (Immediate sirens & multi-camera push)</SelectItem>
                    <SelectItem value="high">High (Active AI stream sampling)</SelectItem>
                    <SelectItem value="medium">Medium (Standard background association)</SelectItem>
                    <SelectItem value="low">Low (Passive archive search)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Last Seen */}
        <TabsContent value="lastseen" className="space-y-4">
          <Card className="border">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-bold">Last Observed Position & Reachable Area</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Last Seen Timestamp:</label>
                  <Input
                    type="datetime-local"
                    value={lastSeenTs}
                    onChange={(e) => setLastSeenTs(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Location Landmark:</label>
                  <Input
                    value={lastSeenLocationText}
                    onChange={(e) => setLastSeenLocationText(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              {/* Map */}
              <ReachableAreaMap
                coordinates={coordinates}
                onCoordinatesChange={(coords, addr) => {
                  setCoordinates(coords);
                  if (addr) setLastSeenLocationText(addr);
                }}
                lastSeenTs={new Date(lastSeenTs).toISOString()}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Direction of Travel:</label>
                  <Input
                    value={direction}
                    onChange={(e) => setDirection(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Context / Circumstances:</label>
                  <Input
                    value={circumstances}
                    onChange={(e) => setCircumstances(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Reference Photos */}
        <TabsContent value="references" className="space-y-4">
          <Card className="border">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-bold">Reference Photos & Pinecone Gallery Sync</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              <ReferencePhotoManager caseId={person.caseId} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 5: Change History */}
        <TabsContent value="history" className="space-y-4">
          <HistoryTimeline history={person.history} />
        </TabsContent>
      </Tabs>

      {/* 409 Diff Conflict Dialog */}
      {conflictData && (
        <DiffConflictDialog
          isOpen={Boolean(conflictData)}
          onClose={() => setConflictData(null)}
          localChanges={conflictData.local}
          serverDocument={conflictData.server}
          onForceOverwrite={() => handleSaveChanges(true)}
          onAcceptServer={fetchDossier}
        />
      )}

      {/* Quick Action: New Sighting Dialog */}
      {isLastSeenDialogOpen && (
        <NewLastSeenDialog
          isOpen={isLastSeenDialogOpen}
          onClose={() => setIsLastSeenDialogOpen(false)}
          personId={person.personId}
          initialCoords={coordinates}
          onSubmitUpdate={async (data) => {
            await missingPersonService.addLastSeen(person.personId, data);
            fetchDossier();
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
