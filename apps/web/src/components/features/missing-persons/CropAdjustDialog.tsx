'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ReferenceImageUI } from '@/types/missing-person';
import { Crop, ZoomIn, RotateCcw, Check, RefreshCw } from 'lucide-react';

interface CropAdjustDialogProps {
  isOpen: boolean;
  onClose: () => void;
  reference?: ReferenceImageUI;
  onReprocess: (id: string, cropData: any) => Promise<void>;
}

export function CropAdjustDialog({
  isOpen,
  onClose,
  reference,
  onReprocess,
}: CropAdjustDialogProps) {
  const [zoom, setZoom] = useState<number>(100);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!reference) return null;

  const handleSaveAndReprocess = async () => {
    setIsSubmitting(true);
    try {
      await onReprocess(reference.id, {
        cropBox: { x: 50, y: 50, width: 200, height: 200 },
        forceReExtract: true,
      });
      onClose();
    } catch (err) {
      console.error('Failed to reprocess reference:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl bg-card text-card-foreground border">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Crop className="h-5 w-5 text-primary" />
            <DialogTitle className="text-base font-bold">Manual Crop & Re-Extraction</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Adjust the crop boundaries to center the subject and eliminate background clutter.
            Reprocessing re-runs ArcFace and OSNet embedding extraction.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Viewport with mock crop guide */}
          <div className="relative border rounded-lg overflow-hidden bg-neutral-950 flex items-center justify-center h-[320px] select-none">
            {/* eslint-disable-next-js-next-image-missing-attribute */}
            <img
              src={reference.url}
              alt="Crop target"
              style={{ transform: `scale(${zoom / 100})` }}
              className="max-h-[300px] w-auto object-contain transition-transform duration-150"
            />

            {/* Simulated interactive crop viewport frame */}
            <div className="absolute inset-8 border-2 border-primary border-dashed rounded pointer-events-none shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
              <div className="absolute top-1 left-1 bg-primary text-primary-foreground text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded">
                Active Biometric Region
              </div>
            </div>
          </div>

          {/* Zoom slider control */}
          <div className="flex items-center gap-3 px-1">
            <ZoomIn className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground w-12">Zoom:</span>
            <Slider
              value={[zoom]}
              onValueChange={(val) => setZoom(val[0])}
              min={100}
              max={250}
              step={5}
              className="flex-1"
            />
            <span className="text-xs font-mono font-bold w-12 text-right">{zoom}%</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setZoom(100)}
              className="h-8 w-8 p-0"
              title="Reset Zoom"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSaveAndReprocess}
            disabled={isSubmitting}
            className="gap-1.5"
          >
            {isSubmitting ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Save Crop & Reprocess
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
