'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ReferenceImageUI, ClothingItem, MissingPerson } from '@/types/missing-person';
import { missingPersonService } from '@/services/missing-person.service';
import { referenceService } from '@/services/reference.service';
import {
  ReferencePhotoManager,
  ReachableAreaMap,
  ReadinessGauge,
} from '@/components/features/missing-persons';
import {
  User,
  ShieldAlert,
  MapPin,
  Shirt,
  Camera,
  FileCheck2,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  AlertTriangle,
  Lock,
  Plus,
  Trash2,
  Save,
  Send,
  Eye,
  EyeOff,
  Copy,
  Check,
  Share2,
} from 'lucide-react';

const DRAFT_STORAGE_KEY = 'sentinel_missing_person_registration_draft_v1';

// Step definitions
const STEPS = [
  { id: 1, title: 'Person Details', short: 'Identity', icon: User },
  { id: 2, title: 'Vulnerability & Priority', short: 'Vulnerability', icon: ShieldAlert },
  { id: 3, title: 'Last Seen Circumstances', short: 'Last Seen', icon: MapPin },
  { id: 4, title: 'Clothing & Items', short: 'Clothing', icon: Shirt },
  { id: 5, title: 'Reference Photos', short: 'Photos', icon: Camera },
  { id: 6, title: 'Reporter & Statutory Authority', short: 'Authority', icon: FileCheck2 },
  { id: 7, title: 'Review & Submit', short: 'Review', icon: CheckCircle2 },
];

// Zod Validation Schema for Registration
const RegistrationSchema = z.object({
  // Step 1: Person details
  fullName: z.string().min(2, 'Full name is required (min 2 chars)'),
  aliases: z.string().optional(),
  gender: z.enum(['male', 'female', 'other', 'unknown']),
  dob: z.string().optional(),
  approxAgeMin: z.number().min(0).max(120),
  approxAgeMax: z.number().min(0).max(120),
  heightCm: z.number().min(40).max(250).optional(),
  build: z.string(),
  hair: z.string(),
  eyes: z.string(),
  skinTone: z.string().optional(),
  distinguishingMarks: z.string().optional(),
  languages: z.string(),
  glasses: z.boolean(),
  beard: z.boolean(),

  // Step 2: Vulnerability & Priority
  isMinor: z.boolean(),
  mentalHealthFlag: z.boolean(),
  requiresUrgentPriority: z.boolean(),
  medicalNotes: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']),

  // Step 3: Last seen
  lastSeenTs: z.string().min(1, 'Last seen timestamp is required'),
  locationText: z.string().min(3, 'Location description or landmark is required'),
  coordinatesLng: z.number(),
  coordinatesLat: z.number(),
  direction: z.string().optional(),
  accompaniedBy: z.string().optional(),
  circumstances: z.string().optional(),

  // Step 4: Clothing
  footwear: z.string().optional(),
  carriedItems: z.string().optional(),

  // Step 6: Reporter & Authority
  reporterName: z.string().min(2, 'Reporter name is required'),
  reporterRelation: z.string().min(2, 'Reporter relationship is required'),
  reporterPhone: z.string().min(6, 'Reporter contact phone is required'),
  reporterEmail: z.string().email().optional().or(z.literal('')),
  reportNumber: z.string().min(3, 'Police FIR or Case Report Number is required'),
  station: z.string().min(2, 'Police station / precinct is required'),
  officerName: z.string().min(2, 'Investigating officer name is required'),
  legalBasisNote: z.string().min(5, 'Statutory authority and legal basis note is required'),
  consentVerified: z.boolean().refine((val) => val === true, {
    message: 'Mandatory verification and consent must be confirmed',
  }),
  statutoryAuthorizationVerified: z.boolean().refine((val) => val === true, {
    message: 'Statutory emergency response authorization must be confirmed',
  }),
});

type RegistrationFormData = z.infer<typeof RegistrationSchema>;

const COLOR_SWATCHES = [
  { name: 'Navy Blue', hex: '#1e3a8a' },
  { name: 'Black', hex: '#0f172a' },
  { name: 'White', hex: '#f8fafc' },
  { name: 'Grey', hex: '#64748b' },
  { name: 'Red', hex: '#dc2626' },
  { name: 'Green', hex: '#16a34a' },
  { name: 'Beige', hex: '#d4b996' },
  { name: 'Yellow', hex: '#eab308' },
];

function RegisterMissingPersonWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const draftIdParam = searchParams.get('draftId');

  const [activeDraftId, setActiveDraftId] = useState<string | null>(draftIdParam || null);
  const [saveDraftModalOpen, setSaveDraftModalOpen] = useState(false);
  const [savedResumeUrl, setSavedResumeUrl] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  const [currentStep, setCurrentStep] = useState(1);
  const [showEncryptedMedical, setShowEncryptedMedical] = useState(false);
  const [clothingChips, setClothingChips] = useState<ClothingItem[]>([
    { type: 'Top', colour: 'Navy Blue', pattern: 'Plain', brand: '' },
    { type: 'Bottom', colour: 'Grey', pattern: 'Plain' },
  ]);
  const [clothingTypeInput, setClothingTypeInput] = useState('');
  const [clothingColorInput, setClothingColorInput] = useState('Navy Blue');
  const [clothingPatternInput, setClothingPatternInput] = useState('Plain');

  const [references, setReferences] = useState<ReferenceImageUI[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autosaveNotice, setAutosaveNotice] = useState<string>('Draft saved locally');

  const generatedCaseId = useRef(`case_${Date.now()}`);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RegistrationFormData>({
    resolver: zodResolver(RegistrationSchema),
    defaultValues: {
      fullName: '',
      aliases: '',
      gender: 'unknown',
      approxAgeMin: 18,
      approxAgeMax: 60,
      build: 'medium',
      hair: 'black',
      eyes: 'brown',
      languages: 'English',
      glasses: false,
      beard: false,
      isMinor: false,
      mentalHealthFlag: false,
      requiresUrgentPriority: false,
      priority: 'high',
      lastSeenTs: new Date().toISOString().slice(0, 16),
      locationText: '',
      coordinatesLng: 103.851959,
      coordinatesLat: 1.29027,
      reporterName: '',
      reporterRelation: '',
      reporterPhone: '',
      reportNumber: `FIR-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`,
      station: 'Central Division Precinct',
      officerName: 'Insp. Sarah Vance',
      legalBasisNote: 'Statutory emergency response authorization for missing vulnerable person search.',
      consentVerified: false,
      statutoryAuthorizationVerified: false,
    },
  });

  const formValues = watch();

  // Load remote draft across devices if draftId query param provided
  useEffect(() => {
    if (!draftIdParam) return;
    const loadRemoteDraft = async () => {
      try {
        const remote = await missingPersonService.getById(draftIdParam);
        if (remote) {
          setActiveDraftId(remote.personId);
          generatedCaseId.current = remote.caseId;
          setValue('fullName', remote.identity.fullName || '');
          setValue('aliases', remote.identity.aliases?.join(', ') || '');
          setValue('gender', (remote.identity.gender as any) || 'unknown');
          setValue('approxAgeMin', remote.identity.approxAgeRange?.min ?? 18);
          setValue('approxAgeMax', remote.identity.approxAgeRange?.max ?? 60);
          setValue('heightCm', remote.physical?.heightCm);
          setValue('build', remote.physical?.build || 'medium');
          setValue('hair', remote.physical?.hair || 'black');
          setValue('eyes', remote.physical?.eyes || 'brown');
          setValue('distinguishingMarks', remote.physical?.distinguishingMarks?.join(', ') || '');
          setValue('languages', remote.identity?.languages?.join(', ') || 'English');
          setValue('glasses', remote.physical?.glasses ?? false);
          setValue('beard', remote.physical?.beard ?? false);
          setValue('isMinor', remote.vulnerability?.isMinor ?? false);
          setValue('mentalHealthFlag', remote.vulnerability?.mentalHealthFlag ?? false);
          setValue('requiresUrgentPriority', remote.vulnerability?.requiresUrgentPriority ?? false);
          setValue('priority', remote.priority || 'high');
          if (remote.lastSeen) {
            setValue(
              'lastSeenTs',
              remote.lastSeen.ts ? remote.lastSeen.ts.slice(0, 16) : new Date().toISOString().slice(0, 16),
            );
            setValue('locationText', remote.lastSeen.locationText || '');
            if (remote.lastSeen.coordinates?.coordinates) {
              setValue('coordinatesLng', remote.lastSeen.coordinates.coordinates[0]);
              setValue('coordinatesLat', remote.lastSeen.coordinates.coordinates[1]);
            }
            setValue('direction', remote.lastSeen.direction || '');
            setValue('accompaniedBy', remote.lastSeen.accompaniedBy || '');
            setValue('circumstances', remote.lastSeen.circumstances || '');
          }
          if (remote.lastSeenClothing) {
            if (remote.lastSeenClothing.items && remote.lastSeenClothing.items.length > 0) {
              setClothingChips(remote.lastSeenClothing.items);
            }
            setValue('footwear', remote.lastSeenClothing.footwear || '');
            setValue('carriedItems', remote.lastSeenClothing.carriedItems?.join(', ') || '');
          }
          if (remote.reporter) {
            setValue('reporterName', remote.reporter.name || '');
            setValue('reporterRelation', remote.reporter.relation || '');
            setValue('reporterPhone', remote.reporter.phoneEncrypted || '');
            setValue('reporterEmail', remote.reporter.emailEncrypted || '');
          }
          if (remote.authority) {
            setValue('reportNumber', remote.authority.reportNumber || '');
            setValue('station', remote.authority.station || '');
            setValue('officerName', remote.authority.officerName || '');
            setValue('legalBasisNote', remote.authority.legalBasisNote || '');
            setValue('consentVerified', true);
            setValue('statutoryAuthorizationVerified', true);
          }
          const refs = await referenceService.getByCaseId(remote.caseId);
          if (refs && refs.length > 0) {
            setReferences(refs);
          }
          setAutosaveNotice(`Resumed remote draft (${remote.personId}) from server`);
        }
      } catch (err) {
        console.warn('Failed to load remote draft:', err);
      }
    };
    loadRemoteDraft();
  }, [draftIdParam, setValue]);

  // Load draft from localStorage on initial render if no remote draft
  useEffect(() => {
    if (draftIdParam) return;
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        Object.keys(parsed).forEach((key: any) => {
          setValue(key, parsed[key]);
        });
        setAutosaveNotice('Restored autosaved draft');
      }
    } catch (e) {
      console.warn('Failed to load draft:', e);
    }
  }, [draftIdParam, setValue]);

  // Autosave debounce to localStorage
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(formValues));
        setAutosaveNotice(`Autosaved at ${new Date().toLocaleTimeString()}`);
      } catch (e) {
        console.warn('Autosave error:', e);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [formValues]);

  // Save draft to cloud / server for resumption on another device
  const handleSaveDraftToServer = async () => {
    try {
      setIsSubmitting(true);
      let draftPersonId = activeDraftId;
      const payload: Partial<MissingPerson> = {
        caseId: generatedCaseId.current,
        status: 'draft',
        priority: formValues.priority,
        identity: {
          fullName: formValues.fullName || 'Draft Subject',
          aliases: formValues.aliases ? formValues.aliases.split(',').map((s) => s.trim()) : [],
          gender: formValues.gender,
          approxAgeRange: { min: formValues.approxAgeMin, max: formValues.approxAgeMax },
          languages: formValues.languages ? formValues.languages.split(',').map((s) => s.trim()) : ['English'],
        },
        physical: {
          heightCm: formValues.heightCm,
          build: formValues.build,
          hair: formValues.hair,
          eyes: formValues.eyes,
          distinguishingMarks: formValues.distinguishingMarks
            ? formValues.distinguishingMarks.split(',').map((s) => s.trim())
            : [],
          glasses: formValues.glasses,
          beard: formValues.beard,
        },
        vulnerability: {
          isMinor: formValues.isMinor,
          mentalHealthFlag: formValues.mentalHealthFlag,
          requiresUrgentPriority: formValues.requiresUrgentPriority,
          medicalNotesEncrypted: formValues.medicalNotes,
        },
        lastSeen: {
          ts: formValues.lastSeenTs ? new Date(formValues.lastSeenTs).toISOString() : new Date().toISOString(),
          locationText: formValues.locationText || 'Draft location',
          coordinates: {
            type: 'Point',
            coordinates: [formValues.coordinatesLng, formValues.coordinatesLat],
          },
          direction: formValues.direction,
          circumstances: formValues.circumstances,
        },
        lastSeenClothing: {
          items: clothingChips,
          accessories: [],
          footwear: formValues.footwear,
          carriedItems: formValues.carriedItems ? formValues.carriedItems.split(',').map((s) => s.trim()) : [],
        },
        reporter: {
          name: formValues.reporterName || 'Draft Reporter',
          relation: formValues.reporterRelation || 'Other',
          phoneEncrypted: formValues.reporterPhone,
          contactPreference: 'phone',
        },
        authority: {
          reportNumber: formValues.reportNumber || 'DRAFT-IN-PROGRESS',
          station: formValues.station || 'Central Precinct',
          officerName: formValues.officerName || 'Investigator',
          authorizedBy: formValues.officerName || 'Investigator',
          authorizedAt: new Date().toISOString(),
          legalBasisNote: formValues.legalBasisNote || 'Statutory Emergency Draft',
        },
      };

      if (draftPersonId) {
        await missingPersonService.patch(draftPersonId, payload);
      } else {
        const created = await missingPersonService.create(payload);
        draftPersonId = created.personId;
        setActiveDraftId(created.personId);
      }

      const resumeUrl = `${window.location.origin}/missing-persons/new?draftId=${draftPersonId}`;
      setSavedResumeUrl(resumeUrl);
      setSaveDraftModalOpen(true);
      setAutosaveNotice(`Saved to server as ${draftPersonId}`);
    } catch (err: any) {
      alert(`Draft save failed: ${err?.message || 'Server error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Auto-suggest priority based on vulnerability
  useEffect(() => {
    if (formValues.isMinor || formValues.mentalHealthFlag || formValues.requiresUrgentPriority) {
      setValue('priority', 'critical');
    } else {
      setValue('priority', 'high');
    }
  }, [formValues.isMinor, formValues.mentalHealthFlag, formValues.requiresUrgentPriority, setValue]);

  const addClothingChip = () => {
    if (!clothingTypeInput.trim()) return;
    setClothingChips([
      ...clothingChips,
      {
        type: clothingTypeInput.trim(),
        colour: clothingColorInput,
        pattern: clothingPatternInput,
      },
    ]);
    setClothingTypeInput('');
  };

  const removeClothingChip = (index: number) => {
    setClothingChips(clothingChips.filter((_, i) => i !== index));
  };

  // Form submission handler
  const onSubmit = async (data: RegistrationFormData) => {
    if (references.length === 0) {
      alert('Please upload at least 1 reference photo before submitting.');
      setCurrentStep(5);
      return;
    }

    setIsSubmitting(true);
    try {
      const newDossier = await missingPersonService.create({
        caseId: generatedCaseId.current,
        status: 'active',
        priority: data.priority,
        identity: {
          fullName: data.fullName,
          aliases: data.aliases ? data.aliases.split(',').map((s) => s.trim()) : [],
          gender: data.gender,
          dob: data.dob,
          approxAgeRange: { min: data.approxAgeMin, max: data.approxAgeMax },
          languages: data.languages ? data.languages.split(',').map((s) => s.trim()) : ['English'],
        },
        physical: {
          heightCm: data.heightCm,
          build: data.build,
          hair: data.hair,
          eyes: data.eyes,
          distinguishingMarks: data.distinguishingMarks
            ? data.distinguishingMarks.split(',').map((s) => s.trim())
            : [],
          glasses: data.glasses,
          beard: data.beard,
        },
        vulnerability: {
          isMinor: data.isMinor,
          mentalHealthFlag: data.mentalHealthFlag,
          requiresUrgentPriority: data.requiresUrgentPriority,
          medicalNotesEncrypted: data.medicalNotes,
        },
        lastSeen: {
          ts: new Date(data.lastSeenTs).toISOString(),
          locationText: data.locationText,
          coordinates: {
            type: 'Point',
            coordinates: [data.coordinatesLng, data.coordinatesLat],
          },
          direction: data.direction,
          accompaniedBy: data.accompaniedBy,
          circumstances: data.circumstances,
        },
        lastSeenClothing: {
          items: clothingChips,
          accessories: [],
          footwear: data.footwear,
          carriedItems: data.carriedItems ? data.carriedItems.split(',').map((s) => s.trim()) : [],
        },
        reporter: {
          name: data.reporterName,
          relation: data.reporterRelation,
          phoneEncrypted: data.reporterPhone,
          emailEncrypted: data.reporterEmail,
          contactPreference: 'phone',
        },
        authority: {
          reportNumber: data.reportNumber,
          station: data.station,
          officerName: data.officerName,
          authorizedBy: data.officerName,
          authorizedAt: new Date().toISOString(),
          legalBasisNote: data.legalBasisNote,
        },
      });

      // Clear draft upon successful creation
      localStorage.removeItem(DRAFT_STORAGE_KEY);

      // Redirect to newly registered missing person dossier
      router.push(`/missing-persons/${newDossier.personId}`);
    } catch (err: any) {
      console.error('Registration failed:', err);
      alert(`Submission failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Register Missing Person Dossier</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Step-by-step statutory intake wizard with live biometric verification and search readiness indexing.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[11px] font-mono gap-1 text-muted-foreground">
            <Save className="h-3 w-3" /> {autosaveNotice}
          </Badge>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSaveDraftToServer}
            disabled={isSubmitting}
            className="h-8 text-xs gap-1.5"
            title="Save draft to server so you can resume on another phone, tablet, or terminal"
          >
            <Share2 className="h-3.5 w-3.5 text-primary" />
            <span>Save to Cloud</span>
          </Button>
          <Link href="/missing-persons">
            <Button variant="ghost" size="sm" className="text-xs">
              Cancel
            </Button>
          </Link>
        </div>
      </div>

      {/* Stepper Navigation Bar (Horizontal on desktop, scrollable on mobile) */}
      <div className="overflow-x-auto pb-2">
        <div className="flex items-center gap-2 min-w-[700px]">
          {STEPS.map((s) => {
            const Icon = s.icon;
            const isCompleted = currentStep > s.id;
            const isCurrent = currentStep === s.id;

            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setCurrentStep(s.id)}
                className={`flex-1 flex items-center gap-2 p-2 rounded-lg border text-left transition-all ${
                  isCurrent
                    ? 'border-primary bg-primary/10 text-primary font-bold shadow-sm'
                    : isCompleted
                    ? 'border-emerald-500/40 bg-emerald-500/5 text-foreground hover:bg-muted/40'
                    : 'border-border/60 text-muted-foreground hover:bg-muted/20'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-mono font-bold ${
                    isCurrent
                      ? 'bg-primary text-primary-foreground'
                      : isCompleted
                      ? 'bg-emerald-600 text-white'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : s.id}
                </div>
                <div className="truncate text-xs">
                  <div className="text-[10px] uppercase font-semibold text-muted-foreground">
                    Step {s.id}
                  </div>
                  <div className="truncate font-medium">{s.short}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Form Body */}
      <form onSubmit={handleSubmit(onSubmit)}>
        {/* STEP 1: Person Details */}
        {currentStep === 1 && (
          <Card className="border">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <User className="h-5 w-5 text-primary" /> Step 1: Person Identity & Physical Traits
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Full Legal Name: <span className="text-destructive">*</span>
                  </label>
                  <Input
                    {...register('fullName')}
                    placeholder="e.g. Maya Lin"
                    className="h-9 text-xs"
                  />
                  {errors.fullName && (
                    <span className="text-[11px] text-destructive">{errors.fullName.message}</span>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Known Aliases / Nicknames:
                  </label>
                  <Input
                    {...register('aliases')}
                    placeholder="Comma separated: May, Little Lin"
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Gender:</label>
                  <Controller
                    name="gender"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
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
                    )}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Date of Birth (if known):</label>
                  <Input type="date" {...register('dob')} className="h-9 text-xs" />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Approx Age Range:</label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      {...register('approxAgeMin', { valueAsNumber: true })}
                      placeholder="Min"
                      className="h-9 text-xs"
                    />
                    <span className="text-muted-foreground text-xs">to</span>
                    <Input
                      type="number"
                      {...register('approxAgeMax', { valueAsNumber: true })}
                      placeholder="Max"
                      className="h-9 text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Height (cm):</label>
                  <Input
                    type="number"
                    {...register('heightCm', { valueAsNumber: true })}
                    placeholder="e.g. 155"
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Build:</label>
                  <Input
                    {...register('build')}
                    placeholder="e.g. slender, athletic, stocky"
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Hair:</label>
                  <Input
                    {...register('hair')}
                    placeholder="e.g. black, shoulder-length"
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Eyes:</label>
                  <Input
                    {...register('eyes')}
                    placeholder="e.g. brown, hazel"
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  Distinguishing Marks (Scars, Tattoos, Piercings, Birthmarks):
                </label>
                <Input
                  {...register('distinguishingMarks')}
                  placeholder="e.g. Small birthmark beneath left ear, surgical scar on right knee"
                  className="h-9 text-xs"
                />
              </div>

              <div className="flex flex-wrap items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <Controller
                    name="glasses"
                    control={control}
                    render={({ field }) => (
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    )}
                  />
                  <span>Wears Glasses</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <Controller
                    name="beard"
                    control={control}
                    render={({ field }) => (
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    )}
                  />
                  <span>Has Beard / Facial Hair</span>
                </label>
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 2: Vulnerability & Priority */}
        {currentStep === 2 && (
          <Card className="border">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-amber-500" /> Step 2: Vulnerability Factors & Suggested Priority
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-lg border bg-muted/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">Minor / Child (&lt; 18)</span>
                    <Controller
                      name="isMinor"
                      control={control}
                      render={({ field }) => (
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      )}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Automatically triggers Amber Alert rapid response cascade.
                  </p>
                </div>

                <div className="p-3 rounded-lg border bg-muted/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">Mental Health / Dementia</span>
                    <Controller
                      name="mentalHealthFlag"
                      control={control}
                      render={({ field }) => (
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      )}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Silver Alert protocol for disoriented individuals at high risk.
                  </p>
                </div>

                <div className="p-3 rounded-lg border bg-muted/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">Urgent Life Danger</span>
                    <Controller
                      name="requiresUrgentPriority"
                      control={control}
                      render={({ field }) => (
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      )}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Immediate critical search priority with real-time push alerts.
                  </p>
                </div>
              </div>

              {/* Medical / Mental Health Notes (Field-Level Encrypted, Hidden by Default) */}
              <div className="rounded-lg border p-3 space-y-2 bg-muted/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                    <Lock className="h-4 w-4 text-emerald-500" />
                    <span>Confidential Medical & Prescription Notes (Field-Level Encrypted)</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => setShowEncryptedMedical(!showEncryptedMedical)}
                  >
                    {showEncryptedMedical ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    {showEncryptedMedical ? 'Hide Notes' : 'Reveal & Edit'}
                  </Button>
                </div>

                {showEncryptedMedical ? (
                  <Textarea
                    {...register('medicalNotes')}
                    placeholder="Enter confidential health conditions, daily life-saving medications (e.g. Ventolin inhaler, cardiac drugs), or cognitive impairments..."
                    className="text-xs min-h-[80px]"
                  />
                ) : (
                  <div className="p-2.5 rounded bg-muted/40 font-mono text-xs text-muted-foreground flex items-center justify-between">
                    <span>••••••••••••••••••••••••••••••••••••••••••••••</span>
                    <span className="text-[10px] text-emerald-600 font-bold uppercase">Encrypted</span>
                  </div>
                )}
              </div>

              {/* Priority Selector & Explanation */}
              <div className="space-y-1.5 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Investigation Priority Level:
                  </label>
                  <span className="text-[11px] font-mono text-primary font-semibold">
                    {formValues.isMinor || formValues.mentalHealthFlag || formValues.requiresUrgentPriority
                      ? 'Suggested: CRITICAL (Statutory Escalation Triggered)'
                      : 'Suggested: HIGH'}
                  </span>
                </div>
                <Controller
                  name="priority"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="critical">Critical (Immediate multi-camera dispatch & siren alerts)</SelectItem>
                        <SelectItem value="high">High (Active AI stream sampling at 4-8 FPS)</SelectItem>
                        <SelectItem value="medium">Medium (Standard background association at 2 FPS)</SelectItem>
                        <SelectItem value="low">Low (Passive archive search)</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 3: Last Seen */}
        {currentStep === 3 && (
          <Card className="border">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <MapPin className="h-5 w-5 text-destructive" /> Step 3: Last Seen Circumstances & Reachable Area
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Date & Time Last Observed: <span className="text-destructive">*</span>
                  </label>
                  <Input
                    type="datetime-local"
                    {...register('lastSeenTs')}
                    className="h-9 text-xs"
                  />
                  {errors.lastSeenTs && (
                    <span className="text-[11px] text-destructive">{errors.lastSeenTs.message}</span>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Location Name / Landmark: <span className="text-destructive">*</span>
                  </label>
                  <Input
                    {...register('locationText')}
                    placeholder="e.g. Central Transit Hub, Platform 4"
                    className="h-9 text-xs"
                  />
                  {errors.locationText && (
                    <span className="text-[11px] text-destructive">{errors.locationText.message}</span>
                  )}
                </div>
              </div>

              {/* Reachable Area Map */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">
                  Interactive Geo-Placement & Nearby Surveillance Preview:
                </label>
                <ReachableAreaMap
                  coordinates={[formValues.coordinatesLng, formValues.coordinatesLat]}
                  onCoordinatesChange={(coords, addr) => {
                    setValue('coordinatesLng', coords[0]);
                    setValue('coordinatesLat', coords[1]);
                    if (addr && !formValues.locationText) {
                      setValue('locationText', addr);
                    }
                  }}
                  lastSeenTs={formValues.lastSeenTs}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Direction of Travel:
                  </label>
                  <Input
                    {...register('direction')}
                    placeholder="e.g. North toward West Concourse"
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Accompanied By / Companions:
                  </label>
                  <Input
                    {...register('accompaniedBy')}
                    placeholder="e.g. Alone, or seen with adult male in dark jacket"
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  Detailed Circumstances:
                </label>
                <Textarea
                  {...register('circumstances')}
                  placeholder="Describe context: separated from school tour, left personal possessions behind, last phone ping timestamp..."
                  className="text-xs min-h-[70px]"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 4: Clothing and Items */}
        {currentStep === 4 && (
          <Card className="border">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Shirt className="h-5 w-5 text-primary" /> Step 4: Clothing, Footwear & Carried Items
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-4">
              {/* Structured Clothing Chips */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">
                  Structured Clothing Articles (Used for OSNet Re-ID color clustering):
                </label>

                {/* List of active chips */}
                <div className="flex flex-wrap gap-2 min-h-[40px] p-2 rounded-lg border bg-muted/20">
                  {clothingChips.length === 0 ? (
                    <span className="text-xs text-muted-foreground py-1">No clothing items added yet.</span>
                  ) : (
                    clothingChips.map((chip, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-background border text-xs font-medium shadow-sm"
                      >
                        <span className="font-semibold text-primary">{chip.type}:</span>
                        <span>{chip.colour}</span>
                        {chip.pattern && <span className="text-muted-foreground">({chip.pattern})</span>}
                        <button
                          type="button"
                          onClick={() => removeClothingChip(idx)}
                          className="text-muted-foreground hover:text-destructive ml-1"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* Add new clothing item controls */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1">
                  <Input
                    placeholder="Article (e.g. Jacket, T-Shirt, Jeans)"
                    value={clothingTypeInput}
                    onChange={(e) => setClothingTypeInput(e.target.value)}
                    className="h-9 text-xs"
                  />

                  {/* Color Swatch Picker */}
                  <Select value={clothingColorInput} onValueChange={setClothingColorInput}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Select Colour" />
                    </SelectTrigger>
                    <SelectContent>
                      {COLOR_SWATCHES.map((swatch) => (
                        <SelectItem key={swatch.name} value={swatch.name}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3.5 h-3.5 rounded-full border border-black/20"
                              style={{ backgroundColor: swatch.hex }}
                            />
                            <span>{swatch.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Input
                    placeholder="Pattern (e.g. Plain, Plaid, Striped)"
                    value={clothingPatternInput}
                    onChange={(e) => setClothingPatternInput(e.target.value)}
                    className="h-9 text-xs"
                  />

                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={addClothingChip}
                    disabled={!clothingTypeInput.trim()}
                    className="h-9 text-xs gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Article
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Footwear:</label>
                  <Input
                    {...register('footwear')}
                    placeholder="e.g. White Adidas sneakers with black stripes"
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Carried Items & Accessories:
                  </label>
                  <Input
                    {...register('carriedItems')}
                    placeholder="Comma separated: Yellow hairclip, black canvas backpack, silver water bottle"
                    className="h-9 text-xs"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 5: Reference Photos (Using Reusable ReferencePhotoManager) */}
        {currentStep === 5 && (
          <Card className="border">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Camera className="h-5 w-5 text-primary" /> Step 5: Reference Photographs & Biometric Gallery
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              <ReferencePhotoManager
                caseId={generatedCaseId.current}
                initialReferences={references}
                onChange={setReferences}
              />
            </CardContent>
          </Card>
        )}

        {/* STEP 6: Reporter & Statutory Authority */}
        {currentStep === 6 && (
          <Card className="border">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <FileCheck2 className="h-5 w-5 text-primary" /> Step 6: Reporter Contact & Statutory Police Authorization
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Reporter Full Name: <span className="text-destructive">*</span>
                  </label>
                  <Input
                    {...register('reporterName')}
                    placeholder="e.g. Eleanor Lin"
                    className="h-9 text-xs"
                  />
                  {errors.reporterName && (
                    <span className="text-[11px] text-destructive">{errors.reporterName.message}</span>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Relationship to Missing Person: <span className="text-destructive">*</span>
                  </label>
                  <Input
                    {...register('reporterRelation')}
                    placeholder="e.g. Mother, Spouse, Guardian"
                    className="h-9 text-xs"
                  />
                  {errors.reporterRelation && (
                    <span className="text-[11px] text-destructive">{errors.reporterRelation.message}</span>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Reporter Phone Number: <span className="text-destructive">*</span>
                  </label>
                  <Input
                    {...register('reporterPhone')}
                    placeholder="e.g. +65 9123 4567"
                    className="h-9 text-xs"
                  />
                  {errors.reporterPhone && (
                    <span className="text-[11px] text-destructive">{errors.reporterPhone.message}</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">
                    FIR / Police Case Number: <span className="text-destructive">*</span>
                  </label>
                  <Input
                    {...register('reportNumber')}
                    placeholder="e.g. FIR-2026-88192"
                    className="h-9 text-xs"
                  />
                  {errors.reportNumber && (
                    <span className="text-[11px] text-destructive">{errors.reportNumber.message}</span>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Police Precinct / Station: <span className="text-destructive">*</span>
                  </label>
                  <Input
                    {...register('station')}
                    placeholder="e.g. Central Precinct Station 1"
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Investigating Officer: <span className="text-destructive">*</span>
                  </label>
                  <Input
                    {...register('officerName')}
                    placeholder="e.g. Insp. Sarah Vance"
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  Statutory Legal Basis & Search Authorization Note: <span className="text-destructive">*</span>
                </label>
                <Textarea
                  {...register('legalBasisNote')}
                  placeholder="Record formal statutory authority: Police Act § 42(a) Emergency Juvenile Welfare Protocol / Silver Alert missing adult order..."
                  className="text-xs min-h-[60px]"
                />
              </div>

              {/* Mandatory Consents */}
              <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 space-y-3 pt-3">
                <label className="flex items-start gap-2.5 cursor-pointer text-xs">
                  <Controller
                    name="consentVerified"
                    control={control}
                    render={({ field }) => (
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        className="mt-0.5"
                      />
                    )}
                  />
                  <span>
                    <strong className="text-foreground">Reporting Party Consent:</strong> I confirm the reporting family member/guardian has given formal consent to process reference photographs for biometric vision surveillance.
                  </span>
                </label>
                {errors.consentVerified && (
                  <span className="text-[11px] text-destructive block pl-6">
                    {errors.consentVerified.message}
                  </span>
                )}

                <label className="flex items-start gap-2.5 cursor-pointer text-xs">
                  <Controller
                    name="statutoryAuthorizationVerified"
                    control={control}
                    render={({ field }) => (
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    )}
                  />
                  <span>
                    <strong className="text-foreground">Statutory Authority Verified:</strong> This investigation is authorized under lawful jurisdiction. AI candidate alerts will undergo human-in-the-loop review before physical intervention.
                  </span>
                </label>
                {errors.statutoryAuthorizationVerified && (
                  <span className="text-[11px] text-destructive block pl-6">
                    {errors.statutoryAuthorizationVerified.message}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 7: Review and Submit */}
        {currentStep === 7 && (
          <Card className="border">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" /> Step 7: Dossier Summary & Statutory Submission
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-4">
              {/* Validation Errors banner if any */}
              {Object.keys(errors).length > 0 && (
                <div className="p-3 rounded-lg border border-destructive bg-destructive/10 space-y-1.5 text-xs">
                  <div className="font-bold text-destructive flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4" /> Please resolve the following required fields:
                  </div>
                  <ul className="list-disc pl-5 text-destructive space-y-0.5">
                    {errors.fullName && (
                      <li>
                        <button
                          type="button"
                          onClick={() => setCurrentStep(1)}
                          className="underline hover:opacity-80"
                        >
                          Step 1: {errors.fullName.message}
                        </button>
                      </li>
                    )}
                    {errors.lastSeenTs && (
                      <li>
                        <button
                          type="button"
                          onClick={() => setCurrentStep(3)}
                          className="underline hover:opacity-80"
                        >
                          Step 3: {errors.lastSeenTs.message}
                        </button>
                      </li>
                    )}
                    {errors.locationText && (
                      <li>
                        <button
                          type="button"
                          onClick={() => setCurrentStep(3)}
                          className="underline hover:opacity-80"
                        >
                          Step 3: {errors.locationText.message}
                        </button>
                      </li>
                    )}
                    {errors.reporterName && (
                      <li>
                        <button
                          type="button"
                          onClick={() => setCurrentStep(6)}
                          className="underline hover:opacity-80"
                        >
                          Step 6: {errors.reporterName.message}
                        </button>
                      </li>
                    )}
                    {errors.consentVerified && (
                      <li>
                        <button
                          type="button"
                          onClick={() => setCurrentStep(6)}
                          className="underline hover:opacity-80"
                        >
                          Step 6: {errors.consentVerified.message}
                        </button>
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Person & Priority */}
                <div className="p-3.5 rounded-lg border bg-muted/20 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground text-sm">{formValues.fullName || 'Untitled'}</span>
                    <Badge variant="destructive" className="font-mono uppercase text-[10px]">
                      {formValues.priority}
                    </Badge>
                  </div>
                  <div className="text-muted-foreground">
                    {formValues.gender} · {formValues.approxAgeMin}-{formValues.approxAgeMax} yrs · {formValues.heightCm || 160} cm · {formValues.hair} hair
                  </div>
                  <div className="text-muted-foreground truncate">
                    Distinguishing: {formValues.distinguishingMarks || 'None'}
                  </div>
                </div>

                {/* Last Seen & Origin */}
                <div className="p-3.5 rounded-lg border bg-muted/20 space-y-2 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-foreground">
                    <MapPin className="h-4 w-4 text-destructive" />
                    <span>{formValues.locationText || 'No location set'}</span>
                  </div>
                  <div className="text-muted-foreground">
                    Observed: {new Date(formValues.lastSeenTs).toLocaleString()}
                  </div>
                  <div className="text-muted-foreground truncate">
                    Direction: {formValues.direction || 'Unspecified'}
                  </div>
                </div>
              </div>

              {/* References Summary */}
              <div className="p-3.5 rounded-lg border bg-muted/20 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-foreground">
                    Reference Gallery: {references.length} Photos Uploaded
                  </div>
                  <div className="text-muted-foreground">
                    {references.length > 0
                      ? 'ArcFace 512-d and OSNet embeddings extracted with flip TTA.'
                      : 'WARNING: At least 1 reference photo required.'}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentStep(5)}
                  className="h-8 text-xs"
                >
                  Manage Photos
                </Button>
              </div>

              {/* Statutory Confirmation */}
              <div className="p-3.5 rounded-lg border bg-muted/20 text-xs space-y-1">
                <div className="font-bold text-foreground">
                  Statutory FIR Authority: {formValues.reportNumber}
                </div>
                <div className="text-muted-foreground">
                  Precinct: {formValues.station} · Officer: {formValues.officerName}
                </div>
              </div>

              {/* Statutory Prerequisite Verification Checklist */}
              {(() => {
                const hasValidIdentity = Boolean(formValues.fullName?.trim() && formValues.fullName !== 'Draft Subject');
                const hasValidLastSeen = Boolean(formValues.locationText?.trim() && formValues.lastSeenTs);
                const hasValidAuthority = Boolean(
                  formValues.reportNumber?.trim() &&
                  formValues.officerName?.trim() &&
                  formValues.consentVerified &&
                  formValues.statutoryAuthorizationVerified
                );
                const hasValidReferences = references.length > 0 && references.some(
                  (r) => r.type.startsWith('face_') || r.type.startsWith('body_') || (r.detectedFaces?.length || 0) > 0 || (r.detectedBodies?.length || 0) > 0
                );
                const canSubmit = hasValidIdentity && hasValidLastSeen && hasValidAuthority && hasValidReferences;

                return (
                  <div className="p-4 rounded-lg border bg-card space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        <FileCheck2 className="h-4 w-4 text-primary" />
                        Statutory Prerequisites for Search Activation
                      </div>
                      {canSubmit ? (
                        <Badge className="bg-emerald-600 text-white font-mono text-[10px] gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Ready to Submit
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="font-mono text-[10px] gap-1">
                          <AlertTriangle className="h-3 w-3" /> Prerequisite Incomplete
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div className={`p-2.5 rounded border flex items-center gap-2 ${hasValidIdentity ? 'border-emerald-500/40 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400' : 'border-destructive/40 bg-destructive/5 text-destructive'}`}>
                        {hasValidIdentity ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
                        <span>1. Identity: {hasValidIdentity ? formValues.fullName : 'Subject name is required'}</span>
                      </div>

                      <div className={`p-2.5 rounded border flex items-center gap-2 ${hasValidLastSeen ? 'border-emerald-500/40 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400' : 'border-destructive/40 bg-destructive/5 text-destructive'}`}>
                        {hasValidLastSeen ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
                        <span>2. Last Seen: {hasValidLastSeen ? 'Place & time recorded' : 'Location & time required'}</span>
                      </div>

                      <div className={`p-2.5 rounded border flex items-center gap-2 ${hasValidAuthority ? 'border-emerald-500/40 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400' : 'border-destructive/40 bg-destructive/5 text-destructive'}`}>
                        {hasValidAuthority ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
                        <span>3. Authority: {hasValidAuthority ? `FIR ${formValues.reportNumber} authorized` : 'FIR & consent confirmation required'}</span>
                      </div>

                      <div className={`p-2.5 rounded border flex items-center gap-2 ${hasValidReferences ? 'border-emerald-500/40 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400' : 'border-destructive/40 bg-destructive/5 text-destructive'}`}>
                        {hasValidReferences ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
                        <span>4. References: {hasValidReferences ? `${references.length} photo(s) enrolled` : 'Min 1 usable face/body photo required'}</span>
                      </div>
                    </div>

                    {!canSubmit && (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400 bg-amber-500/10 p-2 rounded">
                        In accordance with missing-person protocols, a dossier can only be submitted and activated once full identity, last-seen coordinates, legal authorization, and at least one enrolled reference photo exist.
                      </p>
                    )}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        )}

        {/* Bottom Navigation Buttons */}
        <div className="flex items-center justify-between pt-6 border-t mt-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={currentStep === 1}
            onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
            className="gap-1.5 text-xs"
          >
            <ChevronLeft className="h-4 w-4" /> Previous Step
          </Button>

          <div className="flex items-center gap-2">
            {currentStep < 7 ? (
              <Button
                type="button"
                size="sm"
                onClick={() => setCurrentStep((prev) => Math.min(7, prev + 1))}
                className="gap-1.5 text-xs"
              >
                Next Step <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              (() => {
                const hasValidIdentity = Boolean(formValues.fullName?.trim() && formValues.fullName !== 'Draft Subject');
                const hasValidLastSeen = Boolean(formValues.locationText?.trim() && formValues.lastSeenTs);
                const hasValidAuthority = Boolean(
                  formValues.reportNumber?.trim() &&
                  formValues.officerName?.trim() &&
                  formValues.consentVerified &&
                  formValues.statutoryAuthorizationVerified
                );
                const hasValidReferences = references.length > 0 && references.some(
                  (r) => r.type.startsWith('face_') || r.type.startsWith('body_') || (r.detectedFaces?.length || 0) > 0 || (r.detectedBodies?.length || 0) > 0
                );
                const canSubmit = hasValidIdentity && hasValidLastSeen && hasValidAuthority && hasValidReferences;

                return (
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!canSubmit || isSubmitting}
                    className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                    {isSubmitting ? 'Registering Dossier...' : 'Submit & Activate Multi-Camera Search'}
                  </Button>
                );
              })()
            )}
          </div>
        </div>
      </form>

      {/* Save Draft Cross-Device Modal */}
      <Dialog open={saveDraftModalOpen} onOpenChange={setSaveDraftModalOpen}>
        <DialogContent className="max-w-md bg-card text-card-foreground border">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Share2 className="h-5 w-5 text-primary" /> Draft Saved to Server
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              Your registration progress has been saved to the centralized server.
              You can resume editing this dossier on any device (phone, tablet, or patrol unit) using the link below:
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="p-2.5 rounded bg-muted/30 border font-mono text-xs flex items-center justify-between gap-2 overflow-x-auto">
              <span className="truncate select-all text-primary font-semibold">{savedResumeUrl}</span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 shrink-0 text-xs gap-1"
                onClick={() => {
                  navigator.clipboard.writeText(savedResumeUrl);
                  setCopiedLink(true);
                  setTimeout(() => setCopiedLink(false), 2000);
                }}
              >
                {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedLink ? 'Copied' : 'Copy'}</span>
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              This case is also listed under the <span className="font-semibold text-foreground">Drafts</span> filter on the Missing Persons directory.
            </p>
          </div>

          <DialogFooter>
            <Button size="sm" onClick={() => setSaveDraftModalOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function RegisterMissingPersonPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs text-muted-foreground">Loading registration wizard...</div>}>
      <RegisterMissingPersonWizard />
    </Suspense>
  );
}
