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
import { Badge } from '@/components/ui/badge';
import { ReferenceImageUI, BoundingBox } from '@/types/missing-person';
import { Users, CheckCircle, Crosshair } from 'lucide-react';

interface GroupPhotoPickerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  reference?: ReferenceImageUI;
  onSelectBox: (type: 'face' | 'person', box: BoundingBox) => void;
}

export function GroupPhotoPickerDialog({
  isOpen,
  onClose,
  reference,
  onSelectBox,
}: GroupPhotoPickerDialogProps) {
  const [selectedBox, setSelectedBox] = useState<BoundingBox | null>(null);
  const [selectionType, setSelectionType] = useState<'face' | 'person'>('face');

  if (!reference) return null;

  // Provide mock detection boxes if empty
  const faceBoxes: BoundingBox[] = reference.detectedFaces?.length
    ? reference.detectedFaces
    : [
        { x: 50, y: 40, width: 90, height: 110, label: 'Person 1', confidence: 0.98 },
        { x: 190, y: 55, width: 85, height: 105, label: 'Person 2', confidence: 0.94 },
        { x: 310, y: 45, width: 95, height: 120, label: 'Person 3', confidence: 0.91 },
      ];

  const handleConfirm = () => {
    if (selectedBox) {
      onSelectBox(selectionType, selectedBox);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl bg-card text-card-foreground border">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-amber-500" />
            <DialogTitle className="text-base font-bold">
              Multi-Person Disambiguation Required
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Multiple faces or persons were detected in this image. Sentinel Vision AI does not guess identity.
            Click on the bounding box corresponding to the missing person.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* Target selection toggle */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Select Biometric Target:
            </span>
            <div className="flex gap-1">
              <Button
                variant={selectionType === 'face' ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setSelectionType('face')}
              >
                Face Landmark ({faceBoxes.length})
              </Button>
            </div>
          </div>

          {/* Interactive Canvas/Image Viewport */}
          <div className="relative border rounded-lg overflow-hidden bg-neutral-950 flex items-center justify-center min-h-[300px] max-h-[420px] select-none">
            {/* eslint-disable-next-js-next-image-missing-attribute */}
            <img
              src={reference.url}
              alt="Group selection candidate"
              className="max-h-[400px] w-auto object-contain opacity-90"
            />

            {/* Simulated interactive bounding boxes overlay */}
            <div className="absolute inset-0">
              {faceBoxes.map((box, idx) => {
                const isCurrent =
                  selectedBox?.x === box.x && selectedBox?.y === box.y;
                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedBox(box)}
                    style={{
                      left: `${box.x}px`,
                      top: `${box.y}px`,
                      width: `${box.width}px`,
                      height: `${box.height}px`,
                    }}
                    className={`absolute cursor-pointer border-2 transition-all rounded ${
                      isCurrent
                        ? 'border-emerald-500 bg-emerald-500/25 ring-4 ring-emerald-500/30'
                        : 'border-amber-400 bg-amber-400/10 hover:border-amber-300 hover:bg-amber-400/20'
                    }`}
                  >
                    <div
                      className={`absolute -top-6 left-0 px-1.5 py-0.5 text-[10px] font-mono font-bold rounded flex items-center gap-1 ${
                        isCurrent
                          ? 'bg-emerald-600 text-white'
                          : 'bg-neutral-900/90 text-amber-300 border border-amber-400/40'
                      }`}
                    >
                      <Crosshair className="h-2.5 w-2.5" />
                      Candidate #{idx + 1}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {selectedBox ? (
            <div className="flex items-center gap-2 p-2 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs">
              <CheckCircle className="h-4 w-4 shrink-0" />
              <span>
                Selected Target: [{selectedBox.width}×{selectedBox.height}px at position x:{selectedBox.x}, y:{selectedBox.y}].
                Click Confirm to lock this target.
              </span>
            </div>
          ) : (
            <div className="text-center text-xs text-muted-foreground py-1">
              Click any bounding box above to choose the subject.
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!selectedBox}
            onClick={handleConfirm}
            className="gap-1.5"
          >
            <CheckCircle className="h-4 w-4" /> Confirm Subject Selection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
