'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useMobileAuthStore } from '@/stores/mobile-auth.store';
import { useMobileDeviceStore } from '@/stores/mobile-device.store';
import { mobileDeviceService } from '@/services/mobile-device.service';
import {
  Smartphone,
  Plus,
  Radio,
  CheckCircle2,
  Clock,
  XCircle,
  Shield,
  Loader2,
  ArrowRight,
  Compass,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function MobileDevicesPage() {
  const router = useRouter();
  const { isAuthenticated, isCheckingAuth } = useMobileAuthStore();
  const { devices, isLoading, loadDevices, activeDeviceId, setActiveDeviceId, storeDeviceKey } =
    useMobileDeviceStore();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [defaultFacing, setDefaultFacing] = useState<'environment' | 'user'>('environment');
  const [shareGps, setShareGps] = useState(true);
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isCheckingAuth && !isAuthenticated) {
      router.push('/m/login');
      return;
    }
    if (isAuthenticated) {
      loadDevices();
    }
  }, [isAuthenticated, isCheckingAuth, loadDevices, router]);

  const handleAddDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!consentConfirmed) {
      setError('You must accept the statutory streaming consent.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Detect platform and browser
      const platform = navigator.userAgent.includes('iPhone')
        ? 'iOS'
        : navigator.userAgent.includes('Android')
        ? 'Android'
        : 'Mobile Web';
      const browser = navigator.userAgent.includes('Chrome')
        ? 'Chrome'
        : navigator.userAgent.includes('Safari')
        ? 'Safari'
        : 'Browser';

      const res = await mobileDeviceService.addDevice({
        label: label || 'Mobile Broadcaster',
        platform,
        browser,
        defaultFacing,
        shareGps,
        consentConfirmed: true,
      });

      // Save deviceKey in local storage for session binding
      storeDeviceKey(res.deviceId, res.deviceKey);
      setActiveDeviceId(res.deviceId);
      setIsAddOpen(false);
      await loadDevices();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to add device.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLaunchStream = (deviceId: string) => {
    setActiveDeviceId(deviceId);
    router.push('/m/stream');
  };

  return (
    <div className="space-y-4">
      {/* Title & Rapid Action */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold">Field Streaming Devices</h2>
          <p className="text-xs text-muted-foreground">Manage cameras bound to this operator account.</p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            // Suggest default label from device
            setLabel(navigator.userAgent.includes('iPhone') ? 'iPhone Bodycam' : 'Android Field Cam');
            setIsAddOpen(true);
          }}
          className="h-8 gap-1.5 text-xs"
        >
          <Plus className="h-3.5 w-3.5" /> Add Phone
        </Button>
      </div>

      {isLoading ? (
        <div className="p-8 flex flex-col items-center justify-center text-muted-foreground gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-xs font-mono">Loading registered devices...</span>
        </div>
      ) : devices.length === 0 ? (
        <Card className="border-dashed border-border/80 text-center p-8">
          <Smartphone className="h-10 w-10 mx-auto text-muted-foreground/60 mb-2" />
          <h3 className="text-sm font-semibold">No Devices Registered</h3>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto mt-1 mb-4">
            Register this phone camera to start streaming live footage to the Command Center search team.
          </p>
          <Button size="sm" onClick={() => setIsAddOpen(true)} className="gap-1.5 text-xs">
            <Plus className="h-3.5 w-3.5" /> Register This Phone Now
          </Button>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {devices.map((device) => {
            const isApproved = device.status === 'approved';
            const isPending = device.status === 'pending_approval';
            const isRevoked = device.status === 'revoked';

            return (
              <Card
                key={device.deviceId}
                className={cn(
                  'border transition-all',
                  device.deviceId === activeDeviceId
                    ? 'border-primary/80 bg-primary/5'
                    : 'border-border',
                )}
              >
                <CardContent className="p-3.5 space-y-2.5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-muted/40 border">
                        <Smartphone className="h-4 w-4 text-foreground" />
                      </div>
                      <div>
                        <span className="font-bold text-xs block text-foreground">
                          {device.label}
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {device.platform} • {device.cameraId}
                        </span>
                      </div>
                    </div>

                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[9px] uppercase font-mono px-1.5 py-0',
                        isApproved
                          ? 'border-emerald-500 text-emerald-500'
                          : isPending
                          ? 'border-amber-500 text-amber-500'
                          : 'border-rose-500 text-rose-500',
                      )}
                    >
                      {device.status.replace('_', ' ')}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono border-t pt-2">
                    <span className="flex items-center gap-1">
                      <Compass className="h-3 w-3" /> GPS: {device.shareGps ? 'Enabled' : 'Disabled'}
                    </span>
                    <span>Facing: {device.defaultFacing}</span>
                  </div>

                  {isApproved && (
                    <Button
                      size="sm"
                      onClick={() => handleLaunchStream(device.deviceId)}
                      className="w-full h-8 text-xs gap-1.5 font-semibold"
                    >
                      <Radio className="h-3.5 w-3.5 animate-pulse" /> Launch Broadcaster
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Device Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-sm bg-background border-border">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base font-bold">Register This Phone</DialogTitle>
            <DialogDescription className="text-xs">
              Bind your mobile camera sensor to your tactical operator account.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddDevice} className="space-y-3.5 pt-2">
            {error && (
              <div className="p-2 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                {error}
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs">Terminal / Phone Label</Label>
              <Input
                required
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Officer Vance - Patrol Alpha"
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Default Camera Facing</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={defaultFacing === 'environment' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDefaultFacing('environment')}
                  className="h-8 text-xs"
                >
                  Back (Rear Lens)
                </Button>
                <Button
                  type="button"
                  variant={defaultFacing === 'user' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDefaultFacing('user')}
                  className="h-8 text-xs"
                >
                  Front (Selfie)
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/20">
              <div className="space-y-0.5">
                <Label className="text-xs font-semibold cursor-pointer">Share GPS Telemetry</Label>
                <p className="text-[10px] text-muted-foreground">
                  Plots real-time moving officer coordinates on the map.
                </p>
              </div>
              <Switch checked={shareGps} onCheckedChange={setShareGps} />
            </div>

            <div className="flex items-start gap-2 pt-1">
              <Checkbox
                id="consent-device"
                checked={consentConfirmed}
                onCheckedChange={(c) => setConsentConfirmed(Boolean(c))}
                className="mt-0.5"
              />
              <Label htmlFor="consent-device" className="text-xs leading-snug cursor-pointer">
                I authorize this device as an official surveillance sensor node. Output stream strictly serves search queues.
              </Label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddOpen(false)}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !consentConfirmed}
                size="sm"
                className="h-8 text-xs gap-1.5"
              >
                {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Save & Authorize
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
