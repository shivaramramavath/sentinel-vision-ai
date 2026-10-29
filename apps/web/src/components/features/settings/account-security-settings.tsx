'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { authService, SessionInfo, IdentityInfo } from '@/services/auth.service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Shield,
  KeyRound,
  QrCode,
  Smartphone,
  Laptop,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Copy,
  ExternalLink,
  Lock,
} from 'lucide-react';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/+$/, '');

export function AccountSecuritySettings() {
  const { user, setUser } = useAuthStore();

  // Change Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ text: string; error?: boolean } | null>(null);

  // Password strength evaluation
  const passwordStrength = useMemo(() => {
    if (!newPassword) return { score: 0, label: 'Too short', color: 'bg-muted' };
    let score = 0;
    if (newPassword.length >= 10) score += 1;
    if (/[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword)) score += 1;
    if (/[0-9]/.test(newPassword)) score += 1;
    if (/[^A-Za-z0-9]/.test(newPassword)) score += 1;

    switch (score) {
      case 1:
        return { score: 1, label: 'Weak (min 10 characters required)', color: 'bg-red-500' };
      case 2:
        return { score: 2, label: 'Fair (add numbers or symbols)', color: 'bg-amber-500' };
      case 3:
        return { score: 3, label: 'Good', color: 'bg-emerald-500' };
      case 4:
        return { score: 4, label: 'Strong', color: 'bg-emerald-600' };
      default:
        return { score: 0, label: 'Too weak', color: 'bg-red-500' };
    }
  }, [newPassword]);

  // MFA Dialog states
  const [mfaDialogOpen, setMfaDialogOpen] = useState(false);
  const [mfaSetupData, setMfaSetupData] = useState<{ secret: string; otpauthUrl: string; qrCodeDataUrl: string } | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  // Disable MFA states
  const [disableMfaDialogOpen, setDisableMfaDialogOpen] = useState(false);
  const [disableCode, setDisableCode] = useState('');
  const [disableLoading, setDisableLoading] = useState(false);
  const [disableError, setDisableError] = useState<string | null>(null);

  // Sessions state
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  // Linked Identities state
  const [identities, setIdentities] = useState<IdentityInfo[]>([]);
  const [identitiesLoading, setIdentitiesLoading] = useState(false);

  // Load Sessions and Identities
  const loadSessions = async () => {
    setSessionsLoading(true);
    try {
      const data = await authService.getSessions();
      setSessions(data || []);
    } catch {
      // non-blocking
    } finally {
      setSessionsLoading(false);
    }
  };

  const loadIdentities = async () => {
    setIdentitiesLoading(true);
    try {
      const data = await authService.getIdentities();
      setIdentities(data || []);
    } catch {
      // non-blocking
    } finally {
      setIdentitiesLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
    loadIdentities();
  }, []);

  // Handle Change Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);

    if (newPassword.length < 10) {
      setPasswordMsg({ text: 'New password must be at least 10 characters long.', error: true });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ text: 'New passwords do not match.', error: true });
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await authService.changePassword(currentPassword, newPassword);
      setPasswordMsg({ text: res.message || 'Password updated successfully.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      loadSessions();
    } catch (err: any) {
      setPasswordMsg({
        text: err?.response?.data?.message || err?.message || 'Failed to change password.',
        error: true,
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  // Open MFA Setup Modal
  const handleOpenMfaSetup = async () => {
    setMfaDialogOpen(true);
    setMfaLoading(true);
    setMfaError(null);
    setRecoveryCodes(null);
    setMfaCode('');

    try {
      const setup = await authService.setupMfa();
      setMfaSetupData(setup);
    } catch (err: any) {
      setMfaError(err?.response?.data?.message || err?.message || 'Failed to initiate 2FA setup.');
    } finally {
      setMfaLoading(false);
    }
  };

  // Confirm MFA Enable
  const handleConfirmEnableMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaCode) return;

    setMfaLoading(true);
    setMfaError(null);

    try {
      const res = await authService.enableMfa(mfaCode.trim());
      setRecoveryCodes(res.recoveryCodes);
      if (user) {
        setUser({ ...user, mfaEnabled: true });
      }
    } catch (err: any) {
      setMfaError(err?.response?.data?.message || err?.message || 'Invalid confirmation code. Try again.');
    } finally {
      setMfaLoading(false);
    }
  };

  // Disable MFA
  const handleConfirmDisableMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disableCode) return;

    setDisableLoading(true);
    setDisableError(null);

    try {
      await authService.disableMfa(disableCode.trim());
      if (user) {
        setUser({ ...user, mfaEnabled: false });
      }
      setDisableMfaDialogOpen(false);
      setDisableCode('');
    } catch (err: any) {
      setDisableError(err?.response?.data?.message || err?.message || 'Invalid code.');
    } finally {
      setDisableLoading(false);
    }
  };

  // Revoke session
  const handleRevokeSession = async (sessionId: string) => {
    try {
      await authService.revokeSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch {
      // non-blocking
    }
  };

  // Revoke all other sessions
  const handleRevokeAllOtherSessions = async () => {
    try {
      await authService.logoutAll();
      loadSessions();
    } catch {
      // non-blocking
    }
  };

  // Unlink identity
  const handleUnlinkIdentity = async (provider: 'google' | 'github') => {
    try {
      await authService.unlinkIdentity(provider);
      loadIdentities();
    } catch {
      // non-blocking
    }
  };

  const isGoogleLinked = identities.some((i) => i.provider === 'google');
  const isGithubLinked = identities.some((i) => i.provider === 'github');

  return (
    <div className="space-y-6">
      {/* Profile Overview */}
      <Card>
        <CardHeader className="p-4 border-b bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm">Operator Clearance &amp; Profile</CardTitle>
            </div>
            <Badge variant="outline" className="font-mono text-[10px]">
              {user?.status?.toUpperCase() || 'ACTIVE'}
            </Badge>
          </div>
          <CardDescription className="text-xs">
            Assigned identity parameters verified under statutory CJIS authority
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Officer / Operator Name</Label>
            <Input disabled value={user?.fullName || ''} className="h-8 bg-muted/30 font-medium" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Official Email Address</Label>
            <Input disabled value={user?.email || ''} className="h-8 bg-muted/30 font-mono" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Assigned Role</Label>
            <Input disabled value={user?.role || 'Investigator'} className="h-8 bg-muted/30 font-medium" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Badge / Shield ID</Label>
            <Input disabled value={user?.badgeNumber || 'SHIELD-001'} className="h-8 bg-muted/30 font-mono" />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Passphrase Card */}
        <Card>
          <CardHeader className="p-4 border-b bg-muted/20">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm">Change Security Passphrase</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Must be at least 10 characters and satisfy cryptographic complexity standards
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleChangePassword}>
            <CardContent className="p-4 space-y-3 text-xs">
              {passwordMsg && (
                <div
                  className={`rounded-md border p-2.5 text-xs flex items-center gap-2 ${
                    passwordMsg.error
                      ? 'border-destructive/40 bg-destructive/10 text-destructive'
                      : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500'
                  }`}
                >
                  {passwordMsg.error ? (
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                  )}
                  <span>{passwordMsg.text}</span>
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs">Current Passphrase</Label>
                <Input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="h-8 font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">New Passphrase</Label>
                <Input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="h-8 font-mono"
                />
                {newPassword.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <div className="flex h-1 w-full gap-1 overflow-hidden rounded bg-muted">
                      {[1, 2, 3, 4].map((step) => (
                        <div
                          key={step}
                          className={`h-full flex-1 transition-all ${
                            passwordStrength.score >= step ? passwordStrength.color : 'bg-transparent'
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground">{passwordStrength.label}</p>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Confirm New Passphrase</Label>
                <Input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-8 font-mono"
                />
              </div>
            </CardContent>

            <CardFooter className="p-4 pt-0">
              <Button
                type="submit"
                size="sm"
                disabled={passwordLoading || passwordStrength.score < 2}
                className="h-8 text-xs font-medium"
              >
                {passwordLoading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                Update Passphrase
              </Button>
            </CardFooter>
          </form>
        </Card>

        {/* 2FA Card */}
        <Card>
          <CardHeader className="p-4 border-b bg-muted/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm">Two-Factor Authentication (TOTP)</CardTitle>
              </div>
              <Badge
                variant="outline"
                className={`font-mono text-[10px] ${
                  user?.mfaEnabled
                    ? 'text-emerald-500 border-emerald-500/30'
                    : 'text-muted-foreground border-border'
                }`}
              >
                {user?.mfaEnabled ? 'ENABLED' : 'NOT CONFIGURED'}
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Require a time-based one-time code (Google Authenticator, 1Password) on sign-in
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-4 text-xs">
            <p className="text-muted-foreground leading-relaxed">
              Two-factor authentication adds an essential layer of security for law enforcement systems. Once
              activated, every login will prompt for a 6-digit TOTP code.
            </p>

            <div className="flex items-center gap-3 pt-2">
              {user?.mfaEnabled ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDisableMfaDialogOpen(true);
                    setDisableError(null);
                    setDisableCode('');
                  }}
                  className="h-8 text-xs text-destructive hover:bg-destructive/10"
                >
                  <Lock className="mr-1.5 h-3.5 w-3.5" />
                  Disable Two-Factor Auth
                </Button>
              ) : (
                <Button size="sm" onClick={handleOpenMfaSetup} className="h-8 text-xs font-medium">
                  <QrCode className="mr-1.5 h-3.5 w-3.5" />
                  Configure Two-Factor Auth
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Linked Accounts */}
      <Card>
        <CardHeader className="p-4 border-b bg-muted/20">
          <CardTitle className="text-sm">Single Sign-On &amp; Linked Identities</CardTitle>
          <CardDescription className="text-xs">
            Link external identity providers to sign in with one click
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 space-y-3 text-xs">
          {/* Google */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full border flex items-center justify-center bg-background">
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              </div>
              <div>
                <p className="font-medium text-foreground">Google Workspace</p>
                <p className="text-muted-foreground text-[11px]">
                  {isGoogleLinked ? 'Connected to authorized Google identity' : 'Not linked'}
                </p>
              </div>
            </div>

            {isGoogleLinked ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleUnlinkIdentity('google')}
                className="h-8 text-xs text-destructive hover:bg-destructive/10"
              >
                Disconnect
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  window.location.href = `${API_BASE}/api/v1/auth/google`;
                }}
                className="h-8 text-xs gap-1.5"
              >
                <ExternalLink className="h-3 w-3" /> Connect Google
              </Button>
            )}
          </div>

          {/* GitHub */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full border flex items-center justify-center bg-background">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  />
                </svg>
              </div>
              <div>
                <p className="font-medium text-foreground">GitHub Enterprise</p>
                <p className="text-muted-foreground text-[11px]">
                  {isGithubLinked ? 'Connected to authorized GitHub account' : 'Not linked'}
                </p>
              </div>
            </div>

            {isGithubLinked ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleUnlinkIdentity('github')}
                className="h-8 text-xs text-destructive hover:bg-destructive/10"
              >
                Disconnect
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  window.location.href = `${API_BASE}/api/v1/auth/github`;
                }}
                className="h-8 text-xs gap-1.5"
              >
                <ExternalLink className="h-3 w-3" /> Connect GitHub
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Active Sessions */}
      <Card>
        <CardHeader className="p-4 border-b bg-muted/20">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm">Active Terminal Sessions</CardTitle>
              <CardDescription className="text-xs">
                Tokens and active devices authorized to access Sentinel terminal APIs
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRevokeAllOtherSessions}
              className="h-8 text-xs text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Sign Out All Other Sessions
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {sessionsLoading ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                <Loader2 className="mx-auto h-5 w-5 animate-spin" />
              </div>
            ) : sessions.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                No active external sessions recorded.
              </div>
            ) : (
              sessions.map((session) => (
                <div key={session.id} className="flex items-center justify-between p-4 text-xs">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full border bg-muted/30 flex items-center justify-center">
                      <Laptop className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">
                          {session.userAgent || 'Desktop Browser'}
                        </span>
                        {session.isCurrent && (
                          <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary font-mono">
                            CURRENT SESSION
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
                        <span>IP Hash: {session.ipHash || 'N/A'}</span>
                        <span>&middot;</span>
                        <span>Seen: {new Date(session.lastSeenAt).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {!session.isCurrent && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRevokeSession(session.id)}
                      className="h-8 text-xs text-destructive hover:bg-destructive/10"
                    >
                      Revoke
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* 2FA Setup Dialog */}
      <Dialog open={mfaDialogOpen} onOpenChange={setMfaDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">
              {recoveryCodes ? 'Save Emergency Recovery Codes' : 'Configure Two-Factor Authenticator'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {recoveryCodes
                ? 'Store these 8 single-use codes safely. If you lose your device, they are the only way to recover access.'
                : 'Scan the QR code with your authenticator app (Google Authenticator, 1Password, etc.).'}
            </DialogDescription>
          </DialogHeader>

          {recoveryCodes ? (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-2 p-3 bg-muted/50 rounded-md font-mono text-xs text-center border">
                {recoveryCodes.map((code, idx) => (
                  <div key={idx} className="p-1.5 rounded bg-background border font-semibold">
                    {code}
                  </div>
                ))}
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full text-xs h-8"
                onClick={() => {
                  navigator.clipboard.writeText(recoveryCodes.join('\n'));
                }}
              >
                <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy Codes to Clipboard
              </Button>

              <DialogFooter>
                <Button
                  className="w-full h-8 text-xs"
                  onClick={() => {
                    setMfaDialogOpen(false);
                    setRecoveryCodes(null);
                  }}
                >
                  I Have Securely Saved My Codes
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={handleConfirmEnableMfa} className="space-y-4 py-2">
              {mfaError && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{mfaError}</span>
                </div>
              )}

              {mfaLoading && !mfaSetupData ? (
                <div className="flex h-40 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : mfaSetupData ? (
                <div className="space-y-4">
                  {/* QR Code */}
                  <div className="flex justify-center p-2 bg-white rounded-md border w-fit mx-auto">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={mfaSetupData.qrCodeDataUrl}
                      alt="TOTP QR Code"
                      className="h-44 w-44"
                    />
                  </div>

                  <div className="space-y-1 text-center">
                    <p className="text-[11px] text-muted-foreground">Or enter code manually:</p>
                    <code className="text-xs font-mono font-bold bg-muted px-2 py-1 rounded select-all">
                      {mfaSetupData.secret}
                    </code>
                  </div>

                  <div className="space-y-1.5 pt-2">
                    <Label htmlFor="mfaVerifyCode" className="text-xs">
                      Enter 6-digit confirmation code:
                    </Label>
                    <Input
                      id="mfaVerifyCode"
                      type="text"
                      required
                      placeholder="123456"
                      value={mfaCode}
                      onChange={(e) => setMfaCode(e.target.value)}
                      className="h-9 font-mono text-center tracking-widest text-base"
                    />
                  </div>
                </div>
              ) : null}

              <DialogFooter>
                <Button
                  type="submit"
                  disabled={mfaLoading || !mfaCode}
                  className="w-full h-8 text-xs font-medium"
                >
                  {mfaLoading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                  Verify &amp; Activate 2FA
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Disable 2FA Dialog */}
      <Dialog open={disableMfaDialogOpen} onOpenChange={setDisableMfaDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Disable Two-Factor Authentication</DialogTitle>
            <DialogDescription className="text-xs">
              Confirm with your current 6-digit code or an emergency recovery code to disable 2FA.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleConfirmDisableMfa} className="space-y-4 py-2">
            {disableError && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{disableError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="disableCode" className="text-xs">
                Authenticator or Recovery Code:
              </Label>
              <Input
                id="disableCode"
                type="text"
                required
                placeholder="123456 or XXXX-XXXX"
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value)}
                className="h-9 font-mono text-center tracking-widest"
              />
            </div>

            <DialogFooter>
              <Button
                type="submit"
                variant="destructive"
                disabled={disableLoading || !disableCode}
                className="w-full h-8 text-xs font-medium"
              >
                {disableLoading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                Confirm Disable Two-Factor
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
