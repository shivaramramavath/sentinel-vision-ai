'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { mobileAdminService } from '@/services/mobile-admin.service';
import { useCameras } from '@/hooks/use-cameras';
import { getSitesFromCameras } from '@/lib/selectors/camera-selectors';
import {
  Smartphone,
  Copy,
  ExternalLink,
  Share2,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  Radio,
  Users,
  ShieldAlert,
  Loader2,
  RefreshCw,
  BatteryMedium,
  Wifi,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MobileIngestionPanelProps {
  onOpenLive?: (cameraId: string) => void;
}

export function MobileIngestionPanel({ onOpenLive }: MobileIngestionPanelProps) {
  const { data: rawCameras = [] } = useCameras();
  const sites = React.useMemo(() => getSitesFromCameras(rawCameras), [rawCameras]);
  const [baseUrl, setBaseUrl] = useState('http://localhost:3000');
  const [copyFeedback, setCopyFeedback] = useState(false);

  // Invite creation form state
  const [siteId, setSiteId] = useState('site_central');
  const [expiresInHours, setExpiresInHours] = useState(72);
  const [maxUses, setMaxUses] = useState(10);
  const [autoApprove, setAutoApprove] = useState(false);
  const [allowedDomains, setAllowedDomains] = useState('');
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);
  const [createdInviteResult, setCreatedInviteResult] = useState<any | null>(null);

  // Data states
  const [invites, setInvites] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setBaseUrl(window.location.origin);
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [invList, usrList, devList, sessList] = await Promise.all([
        mobileAdminService.getInvites().catch(() => []),
        mobileAdminService.getUsers().catch(() => []),
        mobileAdminService.getDevices().catch(() => []),
        mobileAdminService.getActiveSessions().catch(() => []),
      ]);
      setInvites(invList);
      setUsers(usrList);
      setDevices(devList);
      setActiveSessions(sessList);
    } catch {
      // Fallback
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 8000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const handleShare = (url: string) => {
    if (navigator.share) {
      navigator.share({
        title: 'Sentinel Mobile Broadcaster Registration',
        text: 'Tactical field camera registration link for Sentinel Vision AI',
        url,
      }).catch(() => {});
    } else {
      handleCopy(url);
    }
  };

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingInvite(true);
    try {
      const domains = allowedDomains
        .split(',')
        .map((d) => d.trim().replace(/^@/, ''))
        .filter(Boolean);

      const res = await mobileAdminService.createInvite({
        siteId,
        expiresInHours,
        maxUses,
        autoApprove,
        allowedEmailDomains: domains.length > 0 ? domains : undefined,
      });

      setCreatedInviteResult(res);
      await fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create invite.');
    } finally {
      setIsCreatingInvite(false);
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    if (!confirm('Are you sure you want to revoke this registration invite?')) return;
    try {
      await mobileAdminService.revokeInvite(inviteId);
      await fetchData();
    } catch (err: any) {
      alert('Failed to revoke invite.');
    }
  };

  const handleUserAction = async (userId: string, action: 'approve' | 'reject' | 'suspend') => {
    try {
      await mobileAdminService.updateUserStatus(userId, action);
      await fetchData();
    } catch (err: any) {
      alert(`Action failed: ${err.message}`);
    }
  };

  const handleRevokeDevice = async (deviceId: string) => {
    if (!confirm('Revoke this device? Any active broadcast will be immediately disconnected.')) return;
    try {
      await mobileAdminService.updateDeviceStatus(deviceId, 'revoke');
      await fetchData();
    } catch (err: any) {
      alert('Failed to revoke device.');
    }
  };

  const pendingUsers = users.filter((u) => u.status === 'pending_approval');
  const activeUsers = users.filter((u) => u.status === 'active');
  const registrationLink = `${baseUrl}/m/register`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* LEFT CARD (col-span-5): Registration Link & Invite Generator */}
      <Card className="lg:col-span-5 border-zinc-800 bg-zinc-900/60 shadow-xs flex flex-col">
        <CardHeader className="p-4 border-b border-zinc-800/80 bg-zinc-900/80">
          <div className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-cyan-400" />
            <CardTitle className="text-xs font-bold text-zinc-100">
              Mobile Operator Onboarding
            </CardTitle>
          </div>
          <CardDescription className="text-[11px] text-zinc-400">
            Shareable self-registration portal & multi-use sector invite codes.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-4 space-y-4 text-xs">
          {/* Base Registration Link Strip */}
          <div className="space-y-1.5">
            <Label className="text-[11px] text-zinc-300 font-semibold">
              Public Broadcaster Portal URL
            </Label>
            <div className="flex items-center gap-1.5">
              <Input
                readOnly
                value={registrationLink}
                className="h-8 text-xs font-mono bg-zinc-950 border-zinc-800 text-zinc-300"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleCopy(registrationLink)}
                className="h-8 px-2.5 text-xs border-zinc-700"
                title="Copy Link"
              >
                {copyFeedback ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
              <a href="/m/register" target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline" className="h-8 px-2.5 text-xs border-zinc-700" title="Open PWA">
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </a>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleShare(registrationLink)}
                className="h-8 px-2.5 text-xs border-zinc-700"
                title="Share Link"
              >
                <Share2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Create Invite Form */}
          <form onSubmit={handleCreateInvite} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-zinc-200">Generate Sector Invite Code</span>
              <Badge variant="outline" className="text-[9px] font-mono border-cyan-500/40 text-cyan-400">
                AUTO-SITE ATTACH
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] text-zinc-400">Target Site</Label>
                <select
                  value={siteId}
                  onChange={(e) => setSiteId(e.target.value)}
                  className="w-full h-7 rounded border border-zinc-800 bg-zinc-900 text-[11px] text-zinc-200 px-2"
                >
                  {sites.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] text-zinc-400">TTL / Expiry</Label>
                <select
                  value={expiresInHours}
                  onChange={(e) => setExpiresInHours(parseInt(e.target.value, 10))}
                  className="w-full h-7 rounded border border-zinc-800 bg-zinc-900 text-[11px] text-zinc-200 px-2"
                >
                  <option value={24}>24 Hours</option>
                  <option value={72}>72 Hours (3 Days)</option>
                  <option value={168}>7 Days</option>
                  <option value={720}>30 Days</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] text-zinc-400">Max Registrations</Label>
                <Input
                  type="number"
                  min={1}
                  max={200}
                  value={maxUses}
                  onChange={(e) => setMaxUses(parseInt(e.target.value, 10) || 1)}
                  className="h-7 text-xs bg-zinc-900 border-zinc-800"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] text-zinc-400">Allowed Email Domains</Label>
                <Input
                  placeholder="police.gov, gov.uk"
                  value={allowedDomains}
                  onChange={(e) => setAllowedDomains(e.target.value)}
                  className="h-7 text-xs bg-zinc-900 border-zinc-800"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="space-y-0.5">
                <Label className="text-[11px] text-zinc-300 cursor-pointer">Auto-Approve Operators</Label>
                <p className="text-[9px] text-zinc-500">Skip supervisor verification review</p>
              </div>
              <Switch checked={autoApprove} onCheckedChange={setAutoApprove} />
            </div>

            <Button
              type="submit"
              disabled={isCreatingInvite}
              className="w-full h-8 text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white"
            >
              {isCreatingInvite ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
              Create Invite Link
            </Button>
          </form>

          {/* Active Invites List */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 font-semibold">
              <span>ACTIVE SECTOR INVITES</span>
              <span>{invites.filter((i) => !i.isRevoked && !i.isExpired).length} Valid</span>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto no-scrollbar">
              {invites.length === 0 ? (
                <div className="text-center py-4 text-zinc-500 text-[11px]">No active invites generated.</div>
              ) : (
                invites.map((inv) => (
                  <div
                    key={inv.inviteId}
                    className={cn(
                      'flex items-center justify-between p-2 rounded border text-xs',
                      inv.isRevoked || inv.isExpired
                        ? 'border-zinc-900 bg-zinc-950/40 opacity-50'
                        : 'border-zinc-800 bg-zinc-950/80',
                    )}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-zinc-200">{inv.inviteId}</span>
                        {inv.autoApprove && (
                          <Badge variant="outline" className="text-[8px] px-1 py-0 border-emerald-500/40 text-emerald-400 font-mono">
                            AUTO
                          </Badge>
                        )}
                      </div>
                      <div className="text-[10px] text-zinc-500 font-mono">
                        Used: {inv.usedCount}/{inv.maxUses} • Site: {inv.siteId}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCopy(`${baseUrl}/m/register?invite=${inv.inviteId}`)}
                        className="h-6 px-1.5 text-[10px]"
                        title="Copy Link"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      {!inv.isRevoked && !inv.isExpired && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRevokeInvite(inv.inviteId)}
                          className="h-6 px-1.5 text-[10px] text-rose-400 hover:text-rose-300"
                          title="Revoke Invite"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* RIGHT CARD (col-span-7): Mobile Operators & Devices Tabs */}
      <Card className="lg:col-span-7 border-zinc-800 bg-zinc-900/60 shadow-xs flex flex-col">
        <CardHeader className="p-4 border-b border-zinc-800/80 bg-zinc-900/80 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xs font-bold text-zinc-100 flex items-center gap-2">
              <Users className="h-4 w-4 text-cyan-400" />
              Mobile Operators & Live Ingestion Fleet
            </CardTitle>
            <CardDescription className="text-[11px] text-zinc-400">
              Review registrations, approve streaming devices, and monitor active broadcasers.
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={fetchData}
            className="h-7 w-7 p-0 text-zinc-400 hover:text-zinc-200"
            title="Refresh"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
          </Button>
        </CardHeader>

        <CardContent className="p-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4 bg-zinc-950 p-1 mb-4">
              <TabsTrigger value="pending" className="text-xs gap-1 data-[state=active]:bg-zinc-800">
                Pending
                {pendingUsers.length > 0 && (
                  <Badge variant="outline" className="ml-1 text-[9px] px-1 py-0 bg-amber-500/20 text-amber-400 border-amber-500/40">
                    {pendingUsers.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="active" className="text-xs gap-1 data-[state=active]:bg-zinc-800">
                Operators ({activeUsers.length})
              </TabsTrigger>
              <TabsTrigger value="devices" className="text-xs gap-1 data-[state=active]:bg-zinc-800">
                Devices ({devices.length})
              </TabsTrigger>
              <TabsTrigger value="streams" className="text-xs gap-1 data-[state=active]:bg-zinc-800">
                Live Feeds
                {activeSessions.length > 0 && (
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse ml-1" />
                )}
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: PENDING APPROVALS */}
            <TabsContent value="pending" className="space-y-3">
              {pendingUsers.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-zinc-800 rounded-lg text-zinc-500 text-xs">
                  <CheckCircle2 className="h-6 w-6 mx-auto mb-1 text-emerald-500/60" />
                  <span>No pending mobile operator registrations awaiting approval.</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {pendingUsers.map((user) => (
                    <div
                      key={user.mobileUserId}
                      className="flex items-center justify-between p-3 rounded-lg border border-amber-500/30 bg-amber-950/10 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-zinc-100">{user.fullName}</span>
                          <span className="text-[10px] font-mono text-zinc-400">{user.email}</span>
                        </div>
                        <div className="text-[10px] text-zinc-500 font-mono">
                          Site: {user.siteIds?.[0] || 'Primary'} • Registered: {new Date(user.createdAt).toLocaleTimeString()}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleUserAction(user.mobileUserId, 'approve')}
                          className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUserAction(user.mobileUserId, 'reject')}
                          className="h-7 text-xs border-rose-500/40 text-rose-400 hover:bg-rose-950/40"
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* TAB 2: ACTIVE OPERATORS */}
            <TabsContent value="active" className="space-y-2">
              {activeUsers.length === 0 ? (
                <div className="text-center py-10 text-zinc-500 text-xs">No active operators.</div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto no-scrollbar">
                  {activeUsers.map((u) => (
                    <div
                      key={u.mobileUserId}
                      className="flex items-center justify-between p-2.5 rounded border border-zinc-800 bg-zinc-950/60 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-zinc-200">{u.fullName}</span>
                          <Badge variant="outline" className="text-[9px] border-emerald-500/40 text-emerald-400 px-1 py-0">
                            ACTIVE
                          </Badge>
                        </div>
                        <span className="text-[10px] font-mono text-zinc-500">{u.email}</span>
                      </div>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleUserAction(u.mobileUserId, 'suspend')}
                        className="h-6 text-[10px] text-zinc-400 hover:text-rose-400"
                      >
                        Suspend
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* TAB 3: DEVICES */}
            <TabsContent value="devices" className="space-y-2">
              {devices.length === 0 ? (
                <div className="text-center py-10 text-zinc-500 text-xs">No devices registered.</div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto no-scrollbar">
                  {devices.map((d) => (
                    <div
                      key={d.deviceId}
                      className="flex items-center justify-between p-2.5 rounded border border-zinc-800 bg-zinc-950/60 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-zinc-200">{d.label}</span>
                          <span className="text-[10px] text-zinc-500">({d.operatorName})</span>
                        </div>
                        <div className="text-[10px] font-mono text-zinc-500">
                          {d.platform} • Cam: {d.cameraId} • GPS: {d.shareGps ? 'ON' : 'OFF'}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[9px] uppercase px-1 py-0 font-mono',
                            d.status === 'approved'
                              ? 'border-emerald-500 text-emerald-400'
                              : 'border-rose-500 text-rose-400',
                          )}
                        >
                          {d.status}
                        </Badge>
                        {d.status === 'approved' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRevokeDevice(d.deviceId)}
                            className="h-6 text-[10px] text-rose-400 hover:text-rose-300"
                          >
                            Revoke
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* TAB 4: LIVE STREAMS */}
            <TabsContent value="streams" className="space-y-3">
              {activeSessions.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-zinc-800 rounded-lg text-zinc-500 text-xs">
                  <Radio className="h-6 w-6 mx-auto mb-1 text-zinc-600" />
                  <span>No mobile operators currently broadcasting.</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {activeSessions.map((sess) => (
                    <div
                      key={sess.sessionId}
                      className="rounded-lg border border-emerald-500/40 bg-zinc-950 p-2.5 space-y-2 text-xs"
                    >
                      <div className="relative aspect-video rounded overflow-hidden bg-black flex items-center justify-center">
                        <img
                          src={sess.thumbnailUrl}
                          alt={sess.operatorName}
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/80 border border-emerald-500/50 text-emerald-400 text-[9px] font-mono flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> LIVE
                        </div>
                      </div>

                      <div className="space-y-1">
                        <span className="font-bold text-zinc-200 block truncate">{sess.operatorName}</span>
                        <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono">
                          <span>RTT: {sess.rttMs}ms</span>
                          <span>Battery: {sess.battery}%</span>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        onClick={() => onOpenLive?.(sess.cameraId)}
                        className="w-full h-7 text-xs bg-cyan-600 hover:bg-cyan-500 text-white font-semibold"
                      >
                        Open Live Feed
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
