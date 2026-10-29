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
import { AlertCircle, ArrowRight, RefreshCw, Check } from 'lucide-react';

interface DiffConflictDialogProps {
  isOpen: boolean;
  onClose: () => void;
  localChanges: Record<string, any>;
  serverDocument: Record<string, any>;
  onForceOverwrite: () => void;
  onAcceptServer: () => void;
}

export function DiffConflictDialog({
  isOpen,
  onClose,
  localChanges,
  serverDocument,
  onForceOverwrite,
  onAcceptServer,
}: DiffConflictDialogProps) {
  // Extract conflicting fields
  const diffKeys = Object.keys(localChanges).filter(
    (key) => JSON.stringify(localChanges[key]) !== JSON.stringify(serverDocument?.[key]),
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl bg-card text-card-foreground border border-destructive/50">
        <DialogHeader>
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <DialogTitle className="text-base font-bold">
              Concurrent Modification Conflict (HTTP 409)
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Another investigator updated this dossier while you were making changes.
            Review the discrepancies below before proceeding.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 max-h-[350px] overflow-y-auto">
          <div className="grid grid-cols-2 gap-2 text-xs font-semibold px-2 text-muted-foreground uppercase tracking-wider">
            <div>Your Pending Changes</div>
            <div>Latest Server State (v{serverDocument?.version || 'Latest'})</div>
          </div>

          {diffKeys.length === 0 ? (
            <div className="text-xs text-muted-foreground p-4 text-center">
              No direct field overlap detected; reload to synchronize version counter.
            </div>
          ) : (
            diffKeys.map((key) => (
              <div
                key={key}
                className="grid grid-cols-2 gap-2 p-2.5 rounded-lg border bg-muted/20 text-xs"
              >
                <div className="space-y-1">
                  <span className="font-mono text-[10px] text-primary uppercase font-bold">{key}</span>
                  <div className="p-1.5 rounded bg-background border font-mono text-[11px] overflow-x-auto">
                    {JSON.stringify(localChanges[key], null, 2)}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="font-mono text-[10px] text-muted-foreground uppercase font-bold">{key}</span>
                  <div className="p-1.5 rounded bg-background border font-mono text-[11px] overflow-x-auto text-muted-foreground">
                    {JSON.stringify(serverDocument?.[key] ?? 'None', null, 2)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onAcceptServer();
              onClose();
            }}
            className="gap-1.5"
          >
            <RefreshCw className="h-4 w-4" /> Discard My Changes & Reload Server
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              onForceOverwrite();
              onClose();
            }}
            className="gap-1.5"
          >
            <Check className="h-4 w-4" /> Force Overwrite with My Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
