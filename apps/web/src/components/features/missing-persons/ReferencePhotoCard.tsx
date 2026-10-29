'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { ReferenceImageUI, ReferenceImageType, BoundingBox } from '@/types/missing-person';
import {
  Star,
  Trash2,
  Crop,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Calendar,
  Users,
  Eye,
  Columns,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';

interface ReferencePhotoCardProps {
  reference: ReferenceImageUI;
  onSetPrimary: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateMetadata: (id: string, metadata: { type?: ReferenceImageType; photoTakenAt?: string; source?: string }) => void;
  onOpenCrop: (ref: ReferenceImageUI) => void;
  onOpenGroupPicker: (ref: ReferenceImageUI) => void;
  onCompareWithPrimary?: (ref: ReferenceImageUI) => void;
  onKeepOutlier?: (id: string) => void;
  onRemoveOutlier?: (id: string) => void;
  onReplace?: (id: string, file: File) => void;
}

export function ReferencePhotoCard({
  reference,
  onSetPrimary,
  onDelete,
  onUpdateMetadata,
  onOpenCrop,
  onOpenGroupPicker,
  onCompareWithPrimary,
  onKeepOutlier,
  onRemoveOutlier,
  onReplace,
}: ReferencePhotoCardProps) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [fullViewerOpen, setFullViewerOpen] = useState(false);
  const replaceInputRef = React.useRef<HTMLInputElement | null>(null);

  // Check if photo is older than 3 years
  const isOldPhoto = React.useMemo(() => {
    if (!reference.photoTakenAt) return false;
    const taken = new Date(reference.photoTakenAt).getTime();
    const threeYearsAgo = Date.now() - 3 * 365 * 24 * 60 * 60 * 1000;
    return taken < threeYearsAgo;
  }, [reference.photoTakenAt]);

  // Quality chip color mapping
  const getQualityBadge = (score: number) => {
    if (score >= 80) {
      return (
        <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-[11px] gap-1">
          <CheckCircle2 className="h-3 w-3" /> Excellent ({score}%)
        </Badge>
      );
    }
    if (score >= 65) {
      return (
        <Badge className="bg-blue-600 hover:bg-blue-700 text-white font-mono text-[11px] gap-1">
          Good ({score}%)
        </Badge>
      );
    }
    if (score >= 45) {
      return (
        <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-mono text-[11px] gap-1">
          <AlertTriangle className="h-3 w-3" /> Fair ({score}%)
        </Badge>
      );
    }
    return (
      <Badge variant="destructive" className="font-mono text-[11px] gap-1">
        Poor ({score}%)
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'processing':
        return (
          <Badge variant="outline" className="border-blue-500 text-blue-500 text-[11px] gap-1 animate-pulse">
            <RefreshCw className="h-3 w-3 animate-spin" /> Processing
          </Badge>
        );
      case 'ready':
        return (
          <Badge variant="outline" className="border-emerald-500 text-emerald-600 dark:text-emerald-400 text-[11px]">
            Ready
          </Badge>
        );
      case 'needs_review':
        return (
          <Badge variant="outline" className="border-amber-500 text-amber-500 text-[11px] gap-1">
            <AlertTriangle className="h-3 w-3" /> Needs Review
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="destructive" className="text-[11px]">
            Rejected
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <Card
        className={`relative overflow-hidden border transition-all ${
          reference.isPrimary
            ? 'ring-2 ring-primary border-primary shadow-md'
            : 'hover:border-foreground/40'
        }`}
      >
        {/* Outlier Banner */}
        {reference.isOutlier && (
          <div className="bg-amber-500/15 border-b border-amber-500/30 px-3 py-1.5 flex items-center justify-between text-xs text-amber-600 dark:text-amber-400">
            <div className="flex items-center gap-1.5 font-medium">
              <ShieldAlert className="h-3.5 w-3.5" />
              <span>Possible different person (cosine &lt; 0.62)</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[10px] text-amber-700 dark:text-amber-300 hover:bg-amber-500/20"
                onClick={() => onKeepOutlier?.(reference.id)}
              >
                Keep
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[10px] text-destructive hover:bg-destructive/10"
                onClick={() => onRemoveOutlier?.(reference.id)}
              >
                Remove
              </Button>
            </div>
          </div>
        )}

        <div className="p-3 space-y-3">
          {/* Top image preview and badges */}
          <div className="relative h-48 rounded bg-neutral-950 overflow-hidden flex items-center justify-center group">
            {/* eslint-disable-next-js-next-image-missing-attribute */}
            <img
              src={reference.url}
              alt="Reference"
              className="max-h-full w-auto object-contain cursor-pointer transition-transform group-hover:scale-105"
              onClick={() => setFullViewerOpen(true)}
            />

            {/* Top-left primary badge */}
            {reference.isPrimary && (
              <Badge className="absolute top-2 left-2 bg-primary text-primary-foreground font-semibold text-[10px] gap-1 shadow-sm">
                <Star className="h-3 w-3 fill-current" /> Primary Avatar
              </Badge>
            )}

            {/* CCTV Crop Verified Badge */}
            {reference.type === 'cctv_crop_verified' && !reference.isPrimary && (
              <Badge className="absolute top-2 left-2 bg-emerald-600 text-white font-semibold text-[10px] gap-1 shadow-sm">
                <CheckCircle2 className="h-3 w-3" /> Real-World CCTV Crop
              </Badge>
            )}

            {/* Top-right quick actions overlay */}
            <div className="absolute top-2 right-2 flex items-center gap-1 bg-neutral-900/80 backdrop-blur rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-white hover:text-primary"
                title="View Full with Biometric Boxes"
                onClick={() => setFullViewerOpen(true)}
              >
                <Eye className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-white hover:text-primary"
                title="Crop / Adjust"
                onClick={() => onOpenCrop(reference)}
              >
                <Crop className="h-3.5 w-3.5" />
              </Button>
              {!reference.isPrimary && onCompareWithPrimary && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-white hover:text-primary"
                  title="Compare with Primary"
                  onClick={() => onCompareWithPrimary(reference)}
                >
                  <Columns className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>

            {/* Bottom pose bin tag */}
            <div className="absolute bottom-2 left-2 bg-neutral-900/90 text-neutral-200 text-[10px] font-mono font-medium px-2 py-0.5 rounded backdrop-blur border border-white/10 uppercase">
              Pose: {reference.poseBin.replace('_', ' ')}
            </div>

            {/* Multi-person indicator button if detected multiple */}
            {(reference.detectedFaces?.length || 0) > 1 && (
              <Button
                size="sm"
                variant="secondary"
                className="absolute bottom-2 right-2 h-6 px-2 text-[10px] bg-amber-500/90 hover:bg-amber-500 text-neutral-950 font-bold gap-1 shadow"
                onClick={() => onOpenGroupPicker(reference)}
              >
                <Users className="h-3 w-3" /> Choose Face ({reference.detectedFaces?.length})
              </Button>
            )}
          </div>

          {/* Quality & Status chips */}
          <div className="flex items-center justify-between gap-1">
            {getQualityBadge(reference.qualityScore)}
            {getStatusBadge(reference.status)}
          </div>

          {/* Warnings List */}
          {reference.warnings.length > 0 && (
            <div className="space-y-1">
              {reference.warnings.map((w, i) => (
                <div
                  key={i}
                  className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1.5"
                >
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  <span className="truncate">{w}</span>
                </div>
              ))}
            </div>
          )}

          {/* Old photo warning */}
          {isOldPhoto && (
            <div className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1.5 bg-amber-500/10 p-1.5 rounded">
              <Clock className="h-3 w-3 shrink-0" />
              <span>Taken &gt; 3 years ago (appearance may have shifted)</span>
            </div>
          )}

          {/* Type selector & Metadata */}
          <div className="space-y-2 pt-1 border-t text-xs">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">Biometric Type Label:</label>
              <Select
                value={reference.type}
                onValueChange={(val) =>
                  onUpdateMetadata(reference.id, { type: val as ReferenceImageType })
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="face_front">Frontal Face (0°)</SelectItem>
                  <SelectItem value="face_angled">Angled Face (3/4)</SelectItem>
                  <SelectItem value="face_profile_left">Left Profile (90°)</SelectItem>
                  <SelectItem value="face_profile_right">Right Profile (90°)</SelectItem>
                  <SelectItem value="body_full_front">Full Body Frontal</SelectItem>
                  <SelectItem value="body_full_back">Full Body Back</SelectItem>
                  <SelectItem value="body_upper">Upper Body / Bust</SelectItem>
                  <SelectItem value="clothing_detail">Clothing Detail</SelectItem>
                  <SelectItem value="cctv_crop_verified">Verified CCTV Crop</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Date Taken:
                </label>
                <Input
                  type="date"
                  value={reference.photoTakenAt || ''}
                  onChange={(e) =>
                    onUpdateMetadata(reference.id, { photoTakenAt: e.target.value })
                  }
                  className="h-7 text-xs px-2"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Source / Provenance:</label>
                <Input
                  type="text"
                  placeholder="e.g. Passport, Family"
                  value={reference.source || ''}
                  onChange={(e) => onUpdateMetadata(reference.id, { source: e.target.value })}
                  className="h-7 text-xs px-2"
                />
              </div>
            </div>
          </div>

          {/* Card Actions Bottom Toolbar */}
          <div className="flex items-center justify-between pt-2 border-t">
            {!reference.isPrimary ? (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => onSetPrimary(reference.id)}
              >
                <Star className="h-3 w-3" /> Make Primary
              </Button>
            ) : (
              <span className="text-[11px] font-semibold text-primary">Active Primary</span>
            )}

            <div className="flex items-center gap-1">
              {onReplace && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-foreground/80 hover:text-foreground hover:bg-muted"
                    title="Replace with updated photograph (bumps referenceSetVersion & re-indexes)"
                    onClick={() => replaceInputRef.current?.click()}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline text-[11px] ml-1">Replace</span>
                  </Button>
                  <input
                    ref={replaceInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file && onReplace) {
                        onReplace(reference.id, file);
                      }
                    }}
                  />
                </>
              )}

              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-destructive hover:bg-destructive/10"
                title="Delete reference"
                onClick={() => setDeleteConfirmOpen(true)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="max-w-md bg-card text-card-foreground border">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" /> Delete Reference Photo
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              Are you sure you want to delete this reference photograph?
              This action will permanently purge the associated 512-d ArcFace and OSNet Re-ID vectors
              from the Pinecone gallery index and trigger reference set re-versioning.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setDeleteConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                onDelete(reference.id);
                setDeleteConfirmOpen(false);
              }}
            >
              Confirm & Purge Vectors
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Full-Size Viewer Dialog with Biometric Box Overlay */}
      <Dialog open={fullViewerOpen} onOpenChange={setFullViewerOpen}>
        <DialogContent className="max-w-3xl bg-neutral-950 text-white border-neutral-800 p-4">
          <DialogHeader>
            <DialogTitle className="text-sm font-mono flex items-center justify-between">
              <span>Biometric Verification Overlay — {reference.type}</span>
              <Badge variant="outline" className="text-emerald-400 border-emerald-500/40 font-mono text-[11px]">
                Quality: {reference.qualityScore}%
              </Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="relative flex items-center justify-center min-h-[400px] max-h-[550px] overflow-hidden rounded bg-black">
            {/* eslint-disable-next-js-next-image-missing-attribute */}
            <img
              src={reference.url}
              alt="Full view"
              className="max-h-[520px] w-auto object-contain"
            />
            {/* Detected Face Overlay */}
            {reference.detectedFaces?.map((box, i) => (
              <div
                key={i}
                style={{
                  left: `${box.x}px`,
                  top: `${box.y}px`,
                  width: `${box.width}px`,
                  height: `${box.height}px`,
                }}
                className="absolute border-2 border-emerald-400 bg-emerald-500/10 pointer-events-none rounded"
              >
                <div className="absolute -top-5 left-0 bg-emerald-600 text-white font-mono text-[9px] px-1 py-0.5 rounded">
                  Face Box ({box.width}×{box.height}px)
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              className="text-white border-neutral-700 hover:bg-neutral-800"
              onClick={() => setFullViewerOpen(false)}
            >
              Close Viewer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
