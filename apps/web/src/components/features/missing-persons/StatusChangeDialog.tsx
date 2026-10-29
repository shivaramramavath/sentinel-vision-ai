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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MissingPersonStatus } from '@/types/missing-person';
import { ShieldCheck, CheckCircle2, AlertTriangle } from 'lucide-react';

interface StatusChangeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentStatus: MissingPersonStatus;
  onConfirmStatus: (data: {
    status: MissingPersonStatus;
    reason: string;
    verificationOfficer?: string;
    verificationNotes?: string;
  }) => Promise<void>;
}

export function StatusChangeDialog({
  isOpen,
  onClose,
  currentStatus,
  onConfirmStatus,
}: StatusChangeDialogProps) {
  const [targetStatus, setTargetStatus] = useState<MissingPersonStatus>('found');
  const [reason, setReason] = useState('');
  const [verificationOfficer, setVerificationOfficer] = useState('Insp. Sarah Vance');
  const [verificationNotes, setVerificationNotes] = useState('');

  // Checklist for 'found' status
  const [identityConfirmed, setIdentityConfirmed] = useState(false);
  const [safeCustodyConfirmed, setSafeCustodyConfirmed] = useState(false);
  const [guardianNotified, setGuardianNotified] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const isFoundFlow = targetStatus === 'found' || targetStatus === 'closed';
  const canSubmit =
    reason.trim().length >= 5 &&
    (!isFoundFlow || (identityConfirmed && safeCustodyConfirmed && guardianNotified));

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      await onConfirmStatus({
        status: targetStatus,
        reason,
        verificationOfficer: isFoundFlow ? verificationOfficer : undefined,
        verificationNotes: isFoundFlow ? verificationNotes : undefined,
      });
      onClose();
    } catch (err) {
      console.error('Failed to change status:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg bg-card text-card-foreground border">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <DialogTitle className="text-base font-bold">Update Dossier Lifecycle Status</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Transitioning status updates live monitoring streams and initiates audit retention policies.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Status Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">New Lifecycle State:</label>
            <Select
              value={targetStatus}
              onValueChange={(val) => setTargetStatus(val as MissingPersonStatus)}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active (Full AI Monitoring)</SelectItem>
                <SelectItem value="under_verification">Under Verification (Sighting Review)</SelectItem>
                <SelectItem value="found">Mark as Found (Resolved)</SelectItem>
                <SelectItem value="closed">Closed (Administrative Closure)</SelectItem>
                <SelectItem value="suspended">Suspended (Search Paused)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Mandatory Reason */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">
              Mandatory Justification / Reason: <span className="text-destructive">*</span>
            </label>
            <Textarea
              placeholder="State the official rationale or statutory justification for this lifecycle transition..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="text-xs min-h-[70px]"
            />
          </div>

          {/* Verification Protocol for 'found' or 'closed' */}
          {isFoundFlow && (
            <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 space-y-3">
              <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" />
                <span>Formal Resolution & Handover Verification Checklist</span>
              </div>

              <div className="space-y-2 text-xs">
                <label className="flex items-start gap-2 cursor-pointer">
                  <Checkbox
                    checked={identityConfirmed}
                    onCheckedChange={(checked) => setIdentityConfirmed(Boolean(checked))}
                    className="mt-0.5"
                  />
                  <span>Physical biometric or photo identity confirmed in person by law enforcement.</span>
                </label>

                <label className="flex items-start gap-2 cursor-pointer">
                  <Checkbox
                    checked={safeCustodyConfirmed}
                    onCheckedChange={(checked) => setSafeCustodyConfirmed(Boolean(checked))}
                    className="mt-0.5"
                  />
                  <span>Subject is in safe custody / receiving medical care if required.</span>
                </label>

                <label className="flex items-start gap-2 cursor-pointer">
                  <Checkbox
                    checked={guardianNotified}
                    onCheckedChange={(checked) => setGuardianNotified(Boolean(checked))}
                    className="mt-0.5"
                  />
                  <span>Reporting family member or legal guardian notified of resolution.</span>
                </label>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-emerald-500/20">
                <label className="text-[11px] font-semibold text-muted-foreground">
                  Verifying Officer / Signoff:
                </label>
                <Input
                  type="text"
                  value={verificationOfficer}
                  onChange={(e) => setVerificationOfficer(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting}
            className="gap-1.5"
          >
            <ShieldCheck className="h-4 w-4" /> Confirm Status Change
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
