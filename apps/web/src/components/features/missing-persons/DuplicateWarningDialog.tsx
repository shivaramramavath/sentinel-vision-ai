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
import { DuplicateCaseMatch } from '@/types/missing-person';
import { AlertTriangle, ExternalLink, ArrowRight, ShieldCheck } from 'lucide-react';

interface DuplicateWarningDialogProps {
  isOpen: boolean;
  onClose: () => void;
  uploadedPhotoUrl: string;
  duplicateMatch?: DuplicateCaseMatch;
  onContinueAnyway: () => void;
  onOpenExistingCase: (caseId: string) => void;
}

export function DuplicateWarningDialog({
  isOpen,
  onClose,
  uploadedPhotoUrl,
  duplicateMatch,
  onContinueAnyway,
  onOpenExistingCase,
}: DuplicateWarningDialogProps) {
  if (!duplicateMatch) return null;

  const matchPercent = Math.round(duplicateMatch.similarity * 100);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl bg-card text-card-foreground border border-amber-500/40">
        <DialogHeader>
          <div className="flex items-center gap-2 text-amber-500">
            <AlertTriangle className="h-5 w-5" />
            <DialogTitle className="text-base font-bold">
              Potential Duplicate Case Detected
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            This uploaded face biometric matches an existing registered dossier ({duplicateMatch.caseNumber})
            with <span className="font-semibold text-foreground">{matchPercent}% similarity</span>. Sentinel AI never
            merges cases autonomously. Only a human investigator can decide.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Side-by-side comparison */}
          <div className="grid grid-cols-2 gap-4">
            {/* Newly Uploaded Photo */}
            <div className="border rounded-lg p-3 space-y-2 bg-muted/20 text-center">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Newly Uploaded Photo
              </span>
              <div className="h-44 rounded overflow-hidden bg-neutral-950 flex items-center justify-center">
                {/* eslint-disable-next-js-next-image-missing-attribute */}
                <img
                  src={uploadedPhotoUrl}
                  alt="New Upload"
                  className="max-h-full w-auto object-contain"
                />
              </div>
              <Badge variant="outline" className="text-xs">
                Candidate Under Registration
              </Badge>
            </div>

            {/* Existing Case Match */}
            <div className="border rounded-lg p-3 space-y-2 bg-amber-500/5 border-amber-500/30 text-center">
              <span className="text-[11px] font-semibold text-amber-500 uppercase tracking-wider block">
                Existing Dossier Match ({matchPercent}%)
              </span>
              <div className="h-44 rounded overflow-hidden bg-neutral-950 flex items-center justify-center">
                {/* eslint-disable-next-js-next-image-missing-attribute */}
                <img
                  src={duplicateMatch.thumbnailUrl}
                  alt="Existing Dossier"
                  className="max-h-full w-auto object-contain"
                />
              </div>
              <div className="space-y-0.5 text-xs text-left px-1">
                <div className="font-bold text-foreground truncate">{duplicateMatch.fullName}</div>
                <div className="text-[11px] font-mono text-muted-foreground">{duplicateMatch.caseNumber}</div>
                <div className="text-[11px] text-muted-foreground truncate">{duplicateMatch.lastSeenLocation}</div>
              </div>
            </div>
          </div>

          <div className="p-2.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              If this is the same missing individual, link sighting evidence to the active case instead of creating redundant dossiers to prevent partitioned alert streams.
            </span>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onContinueAnyway();
              onClose();
            }}
          >
            Continue Anyway (Different Person)
          </Button>
          <Button
            size="sm"
            onClick={() => {
              onOpenExistingCase(duplicateMatch.matchCaseId);
              onClose();
            }}
            className="gap-1.5"
          >
            <ExternalLink className="h-4 w-4" /> Open Existing Case ({duplicateMatch.caseNumber})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
