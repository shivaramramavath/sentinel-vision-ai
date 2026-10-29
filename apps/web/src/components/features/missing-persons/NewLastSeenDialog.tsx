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
import { Switch } from '@/components/ui/switch';
import { ReachableAreaMap } from './ReachableAreaMap';
import { MapPin, Navigation, Compass, Sparkles, Send } from 'lucide-react';

interface NewLastSeenDialogProps {
  isOpen: boolean;
  onClose: () => void;
  personId: string;
  initialCoords?: [number, number];
  onSubmitUpdate: (data: {
    ts: string;
    locationText: string;
    coordinates: [number, number];
    direction?: string;
    circumstances?: string;
    triggerSearch: boolean;
  }) => Promise<void>;
}

export function NewLastSeenDialog({
  isOpen,
  onClose,
  personId,
  initialCoords = [103.851959, 1.29027],
  onSubmitUpdate,
}: NewLastSeenDialogProps) {
  const [ts, setTs] = useState(new Date().toISOString().slice(0, 16));
  const [locationText, setLocationText] = useState('');
  const [coordinates, setCoordinates] = useState<[number, number]>(initialCoords);
  const [direction, setDirection] = useState('');
  const [circumstances, setCircumstances] = useState('');
  const [triggerSearch, setTriggerSearch] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!locationText.trim()) return;
    setIsSubmitting(true);
    try {
      await onSubmitUpdate({
        ts: new Date(ts).toISOString(),
        locationText,
        coordinates,
        direction: direction || undefined,
        circumstances: circumstances || undefined,
        triggerSearch,
      });
      onClose();
    } catch (err) {
      console.error('Failed to submit last seen update:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl bg-card text-card-foreground border">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Navigation className="h-5 w-5 text-primary" />
            <DialogTitle className="text-base font-bold">Add New Sighting / Last-Seen Update</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Appending a new verified sighting updates the search perimeter origin, recalculates reachable areas, and alerts adjacent camera nodes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Date & Time of Sighting:</label>
              <Input
                type="datetime-local"
                value={ts}
                onChange={(e) => setTs(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">
                Location Name / Landmark: <span className="text-destructive">*</span>
              </label>
              <Input
                type="text"
                placeholder="e.g. Jurong East MRT, Exit B"
                value={locationText}
                onChange={(e) => setLocationText(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
          </div>

          {/* Interactive Reachable Map */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">Coordinates & Perimeter Preview:</label>
            <ReachableAreaMap
              coordinates={coordinates}
              onCoordinatesChange={(coords, addr) => {
                setCoordinates(coords);
                if (addr && !locationText) setLocationText(addr);
              }}
              lastSeenTs={new Date(ts).toISOString()}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Observed Direction of Travel:</label>
              <Input
                type="text"
                placeholder="e.g. Walking West toward Boon Lay"
                value={direction}
                onChange={(e) => setDirection(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Context / Circumstances:</label>
              <Input
                type="text"
                placeholder="e.g. Spotted on public bus #198"
                value={circumstances}
                onChange={(e) => setCircumstances(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
          </div>

          {/* Trigger New Search Toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-primary/5 border-primary/20">
            <div className="space-y-0.5">
              <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-primary" />
                <span>Start a new search with this update</span>
              </div>
              <div className="text-[11px] text-muted-foreground">
                Automatically launches multi-camera vision tasks for all surveillance nodes inside the new reachable radius.
              </div>
            </div>
            <Switch checked={triggerSearch} onCheckedChange={setTriggerSearch} />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!locationText.trim() || isSubmitting}
            className="gap-1.5"
          >
            <Send className="h-4 w-4" /> Save Sighting Update
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
