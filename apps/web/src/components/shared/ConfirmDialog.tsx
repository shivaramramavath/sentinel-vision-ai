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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';

export interface DecisionPayload {
  decision: 'confirmed_sighting' | 'rejected' | 'need_evidence';
  reasonCode?: string;
  notes?: string;
  checklist?: string[];
}

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  decision: 'confirmed_sighting' | 'rejected' | 'need_evidence';
  candidateName: string;
  cameraName: string;
  isCritical?: boolean;
  onConfirm: (payload: DecisionPayload) => void;
}

const CHECKLIST_ITEMS = [
  { id: 'face', label: 'Face features consistent with reference' },
  { id: 'clothing', label: 'Clothing/accessories match last known attire' },
  { id: 'build', label: 'Physical height, build & gait consistent' },
  { id: 'marks', label: 'Distinguishing marks or carried items visible' },
];

export function ConfirmDialog({
  open,
  onOpenChange,
  decision,
  candidateName,
  cameraName,
  isCritical = false,
  onConfirm,
}: ConfirmDialogProps) {
  const [reasonCode, setReasonCode] = useState<string>('different_person');
  const [notes, setNotes] = useState<string>('');
  const [checkedItems, setCheckedItems] = useState<string[]>([]);

  const handleToggleCheck = (id: string) => {
    setCheckedItems((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleConfirmAction = () => {
    onConfirm({
      decision,
      reasonCode: decision === 'rejected' ? reasonCode : undefined,
      notes,
      checklist: checkedItems,
    });
    onOpenChange(false);
    // Reset state
    setNotes('');
    setCheckedItems([]);
  };

  const canSubmit =
    decision === 'rejected'
      ? Boolean(reasonCode)
      : decision === 'confirmed_sighting'
      ? checkedItems.length > 0
      : true;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            {decision === 'confirmed_sighting' && (
              <>
                <CheckCircle2 className="h-5 w-5 text-blue-500" />
                Confirm Reviewer Decision: Same Person
              </>
            )}
            {decision === 'rejected' && (
              <>
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Reject Candidate: Not The Same Person
              </>
            )}
            {decision === 'need_evidence' && (
              <>
                <AlertTriangle className="h-5 w-5 text-muted-foreground" />
                Flag Candidate: Need More Evidence
              </>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground pt-1">
            Applying decision for possible sighting of{' '}
            <strong className="text-foreground">{candidateName}</strong> on {cameraName}.
          </DialogDescription>
        </DialogHeader>

        {/* 1. Rejection Form: Reason code required */}
        {decision === 'rejected' && (
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Rejection Reason Code (Required)</Label>
              <Select value={reasonCode} onValueChange={setReasonCode}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="different_person">Different person (Facial/body mismatch)</SelectItem>
                  <SelectItem value="wrong_camera_time">Infeasible camera/timestamp (Kinematic violation)</SelectItem>
                  <SelectItem value="low_quality">Severe occlusion / Low crop quality</SelectItem>
                  <SelectItem value="other">Other investigator rationale</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Investigator Notes (Optional)</Label>
              <Textarea
                placeholder="Explain observation details to include in audit log and hard-negative suppression..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="text-xs"
              />
            </div>
            <p className="text-[11px] text-muted-foreground italic">
              Note: Rejected candidates are stored as hard negatives to suppress similar false matches.
            </p>
          </div>
        )}

        {/* 2. Positive Confirmation Form: Checklist required + 2nd reviewer on critical */}
        {decision === 'confirmed_sighting' && (
          <div className="space-y-3 py-2">
            {isCritical && (
              <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-600 dark:text-amber-400">
                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <strong>Critical Case Protocol:</strong> This high-priority case requires second-officer
                  verification before automated broadcasts are dispatched.
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs font-medium">
                Verification Checklist (Select at least 1 verified attribute)
              </Label>
              <div className="space-y-2 rounded-lg border p-3 bg-muted/20">
                {CHECKLIST_ITEMS.map((item) => (
                  <div key={item.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`chk-${item.id}`}
                      checked={checkedItems.includes(item.id)}
                      onCheckedChange={() => handleToggleCheck(item.id)}
                    />
                    <label
                      htmlFor={`chk-${item.id}`}
                      className="text-xs cursor-pointer select-none leading-none text-foreground font-medium"
                    >
                      {item.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Review Notes</Label>
              <Textarea
                placeholder="Document observed landmarks, clothing details or environmental context..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="text-xs"
              />
            </div>
          </div>
        )}

        {/* 3. Need Evidence Form */}
        {decision === 'need_evidence' && (
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Evidence Request Details</Label>
              <Textarea
                placeholder="Specify what angle, adjacent camera, or enhanced frame clip is required..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="text-xs"
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleConfirmAction}
            disabled={!canSubmit}
            variant={decision === 'confirmed_sighting' ? 'default' : 'outline'}
            className={decision === 'confirmed_sighting' ? 'bg-primary text-primary-foreground' : ''}
          >
            {decision === 'confirmed_sighting'
              ? 'Confirm Same Person'
              : decision === 'rejected'
              ? 'Confirm Rejection'
              : 'Submit Evidence Request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
