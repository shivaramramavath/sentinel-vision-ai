'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ReferenceImageUI } from '@/types/missing-person';
import { Columns, Calendar, ShieldCheck, Sparkles } from 'lucide-react';

interface PhotoCompareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  photoA?: ReferenceImageUI;
  photoB?: ReferenceImageUI;
}

export function PhotoCompareDialog({
  isOpen,
  onClose,
  photoA,
  photoB,
}: PhotoCompareDialogProps) {
  if (!photoA || !photoB) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl bg-card text-card-foreground border">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Columns className="h-5 w-5 text-primary" />
            <DialogTitle className="text-base font-bold">Side-by-Side Biometric Comparison</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Compare biometric angles, lighting consistency, and vector quality between two reference entries.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-2">
          {/* Photo A */}
          <div className="border rounded-lg p-3 space-y-3 bg-muted/20">
            <div className="relative h-56 rounded bg-neutral-950 overflow-hidden flex items-center justify-center">
              {/* eslint-disable-next-js-next-image-missing-attribute */}
              <img
                src={photoA.url}
                alt="Reference Photo A"
                className="max-h-full w-auto object-contain"
              />
              {photoA.isPrimary && (
                <Badge className="absolute top-2 left-2 bg-primary text-primary-foreground text-[10px]">
                  Primary
                </Badge>
              )}
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Quality Score:</span>
                <span className="font-mono font-bold text-emerald-500">{photoA.qualityScore}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Pose Bin:</span>
                <Badge variant="outline" className="font-mono text-[11px] capitalize">
                  {photoA.poseBin.replace('_', ' ')}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Type:</span>
                <span className="font-medium capitalize">{photoA.type.replace(/_/g, ' ')}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Date Taken:</span>
                <span className="font-mono text-[11px]">{photoA.photoTakenAt || 'Not specified'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Source:</span>
                <span className="truncate max-w-[140px]">{photoA.source || 'Direct upload'}</span>
              </div>
            </div>
          </div>

          {/* Photo B */}
          <div className="border rounded-lg p-3 space-y-3 bg-muted/20">
            <div className="relative h-56 rounded bg-neutral-950 overflow-hidden flex items-center justify-center">
              {/* eslint-disable-next-js-next-image-missing-attribute */}
              <img
                src={photoB.url}
                alt="Reference Photo B"
                className="max-h-full w-auto object-contain"
              />
              {photoB.isPrimary && (
                <Badge className="absolute top-2 left-2 bg-primary text-primary-foreground text-[10px]">
                  Primary
                </Badge>
              )}
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Quality Score:</span>
                <span className="font-mono font-bold text-emerald-500">{photoB.qualityScore}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Pose Bin:</span>
                <Badge variant="outline" className="font-mono text-[11px] capitalize">
                  {photoB.poseBin.replace('_', ' ')}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Type:</span>
                <span className="font-medium capitalize">{photoB.type.replace(/_/g, ' ')}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Date Taken:</span>
                <span className="font-mono text-[11px]">{photoB.photoTakenAt || 'Not specified'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Source:</span>
                <span className="truncate max-w-[140px]">{photoB.source || 'Direct upload'}</span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
