'use client';

import React, { useState, useEffect, useMemo, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { authService } from '@/services/auth.service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AccountSecuritySettings } from '@/components/features/settings/account-security-settings';
import {
  Shield,
  KeyRound,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Copy,
  LogOut,
  ArrowRight,
  Download,
} from 'lucide-react';

export default function SecuritySetupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isRequiredQuery = searchParams.get('required') === '1';

  const { user, setUser, logout } = useAuthStore();

  const isForcedSetup =
    isRequiredQuery || Boolean(user?.mustChangePassword || user?.mfaEnrollmentRequired);

  // Stepper state: 1 = Change Password, 2 = TOTP Enrollment, 3 = Complete
  const [step, setStep] = useState<1 | 2 | 3>(user?.mustChangePassword ? 1 : 2);

  // Step 1: Change Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Password complexity calculation
  const passwordStrength = useMemo(() => {
    if (!newPassword) return { score: 0, label: 'Too short', color: 'bg-muted' };
    let score = 0;
    if (newPassword.length >= 12) score += 1;
    if (/[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword)) score += 1;
    if (/[0-9]/.test(newPassword)) score += 1;
    if (/[^A-Za-z0-9]/.test(newPassword)) score += 1;

    switch (score) {
      case 1:
        return { score: 1, label: 'Weak (min 12 characters required)', color: 'bg-red-500' };
      case 2:
        return { score: 2, label: 'Fair (add numbers or symbols)', color: 'bg-amber-500' };
      case 3:
        return { score: 3, label: 'Good (almost compliant)', color: 'bg-emerald-500' };
      case 4:
        return { score: 4, label: 'Compliant (Security standard met)', color: 'bg-emerald-600' };
      default:
        return { score: 0, label: 'Too weak', color: 'bg-red-500' };
    }
  }, [newPassword]);

  // Step 2: TOTP setup state
  const [setupData, setSetupData] = useState<{
    secret: string;
    otpauthUrl: string;
    qrCodeDataUrl: string;
  } | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [totpLoading, setTotpLoading] = useState(false);
  const [totpError, setTotpError] = useState<string | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [copiedCodes, setCopiedCodes] = useState(false);

  // When step 2 is active and setupData is not loaded, fetch MFA setup QR
  useEffect(() => {
    if (isForcedSetup && step === 2 && !setupData && !recoveryCodes) {
      authService
        .setupMfa()
        .then((data) => setSetupData(data))
        .catch((err) => {
          setTotpError(err?.response?.data?.message || 'Failed to initiate MFA setup');
        });
    }
  }, [isForcedSetup, step, setupData, recoveryCodes]);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    if (passwordStrength.score < 4) {
      setPasswordError(
        'Password must be at least 12 characters and include upper, lower, number, and symbol characters.',
      );
      return;
    }

    setPasswordLoading(true);
    try {
      await authService.changePassword(currentPassword, newPassword);
      if (user) {
        setUser({ ...user, mustChangePassword: false });
      }
      setStep(2);
    } catch (err: any) {
      setPasswordError(
        err?.response?.data?.message || err?.message || 'Failed to change password. Check your current password.',
      );
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleTotpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTotpError(null);

    if (!totpCode || totpCode.trim().length !== 6) {
      setTotpError('Please enter a valid 6-digit authenticator code.');
      return;
    }

    setTotpLoading(true);
    try {
      const res = await authService.enableMfa(totpCode.trim());
      setRecoveryCodes(res.recoveryCodes || []);
      if (user) {
        setUser({ ...user, mfaEnrollmentRequired: false, mfaEnabled: true });
      }
      setStep(3);
    } catch (err: any) {
      setTotpError(
        err?.response?.data?.message || err?.message || 'Invalid verification code. Please check and retry.',
      );
    } finally {
      setTotpLoading(false);
    }
  };

  const handleCopyRecoveryCodes = () => {
    if (!recoveryCodes) return;
    navigator.clipboard.writeText(recoveryCodes.join('\n'));
    setCopiedCodes(true);
    setTimeout(() => setCopiedCodes(false), 3000);
  };

  const handleDownloadRecoveryCodes = () => {
    if (!recoveryCodes) return;
    const blob = new Blob([recoveryCodes.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sentinel-recovery-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFinishSetup = () => {
    if (user) {
      setUser({ ...user, mustChangePassword: false, mfaEnrollmentRequired: false });
    }
    router.replace('/dashboard');
  };

  // If not a forced setup, render standard account security settings view
  if (!isForcedSetup) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Account &amp; Security Settings</h1>
          <p className="text-xs text-muted-foreground">
            Manage officer credentials, passwords, two-factor authentication, and terminal sessions
          </p>
        </div>
        <AccountSecuritySettings />
      </div>
    );
  }

  // Mandatory blocking setup flow
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-xl space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg border bg-card text-2xl font-bold font-mono">
            ⬡
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Mandatory Security Setup</h1>
          <p className="text-sm text-muted-foreground">
            Statutory CJIS and agency policy requires completing credential security initialization before console access.
          </p>
        </div>

        {/* Blocking Stepper Progress Bar */}
        <div className="grid grid-cols-2 gap-2 text-xs font-medium">
          <div
            className={`p-2.5 rounded border text-center transition-all ${
              step === 1
                ? 'border-primary bg-primary/10 text-primary font-semibold'
                : 'border-border bg-card text-muted-foreground'
            }`}
          >
            1. Update Temporary Password
          </div>
          <div
            className={`p-2.5 rounded border text-center transition-all ${
              step === 2 || step === 3
                ? 'border-primary bg-primary/10 text-primary font-semibold'
                : 'border-border bg-card text-muted-foreground'
            }`}
          >
            2. Two-Factor Authentication (TOTP)
          </div>
        </div>

        {/* STEP 1: CHANGE PASSWORD */}
        {step === 1 && (
          <Card className="border-border shadow-md">
            <CardHeader>
              <div className="flex items-center space-x-2">
                <KeyRound className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Change Bootstrap / Temporary Password</CardTitle>
              </div>
              <CardDescription>
                Your initial administrator account was created with a temporary passphrase. Please set your operational
                secret.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handlePasswordSubmit}>
              <CardContent className="space-y-4">
                {passwordError && (
                  <div className="rounded border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-500 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{passwordError}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs">Current / Bootstrap Password</Label>
                  <Input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="h-9 font-mono text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">New Operational Passphrase</Label>
                  <Input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 12 chars with upper, lower, number, symbol"
                    className="h-9 font-mono text-sm"
                  />
                  {/* Strength Bar */}
                  {newPassword && (
                    <div className="space-y-1 pt-1">
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>Strength: {passwordStrength.label}</span>
                        <span>{passwordStrength.score}/4</span>
                      </div>
                      <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden flex">
                        <div
                          className={`h-full transition-all duration-300 ${passwordStrength.color}`}
                          style={{ width: `${(passwordStrength.score / 4) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Confirm New Passphrase</Label>
                  <Input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new passphrase"
                    className="h-9 font-mono text-sm"
                  />
                </div>
              </CardContent>
              <CardFooter className="flex justify-between border-t pt-4">
                <Button type="button" variant="ghost" size="sm" onClick={() => logout()}>
                  <LogOut className="h-4 w-4 mr-1.5" /> Abort &amp; Log Out
                </Button>
                <Button type="submit" size="sm" disabled={passwordLoading || passwordStrength.score < 4}>
                  {passwordLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      Save &amp; Continue to 2FA <ArrowRight className="h-4 w-4 ml-1.5" />
                    </>
                  )}
                </Button>
              </CardFooter>
            </form>
          </Card>
        )}

        {/* STEP 2: TOTP MFA ENROLLMENT */}
        {step === 2 && (
          <Card className="border-border shadow-md">
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Shield className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Enroll Authenticator App (TOTP)</CardTitle>
              </div>
              <CardDescription>
                Scan the QR code with Google Authenticator, 1Password, or any standard TOTP app.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleTotpSubmit}>
              <CardContent className="space-y-4">
                {totpError && (
                  <div className="rounded border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-500 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{totpError}</span>
                  </div>
                )}

                {setupData ? (
                  <div className="flex flex-col items-center gap-4 py-2">
                    <div className="p-3 bg-white rounded-lg border shadow-sm">
                      <img src={setupData.qrCodeDataUrl} alt="MFA QR Code" className="h-44 w-44" />
                    </div>
                    <div className="text-center space-y-1">
                      <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">
                        Manual Entry Secret
                      </span>
                      <p className="font-mono text-xs bg-muted p-1.5 rounded select-all tracking-widest">
                        {setupData.secret}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center p-8 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" /> Initializing authenticator keys...
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs">Enter 6-Digit Authenticator Code</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className="h-10 text-center font-mono text-lg tracking-[0.4em]"
                    autoFocus
                  />
                </div>
              </CardContent>
              <CardFooter className="flex justify-between border-t pt-4">
                <Button type="button" variant="ghost" size="sm" onClick={() => logout()}>
                  <LogOut className="h-4 w-4 mr-1.5" /> Log Out
                </Button>
                <Button type="submit" size="sm" disabled={totpLoading || totpCode.length !== 6}>
                  {totpLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Verifying...
                    </>
                  ) : (
                    <>
                      Verify &amp; Activate 2FA <ArrowRight className="h-4 w-4 ml-1.5" />
                    </>
                  )}
                </Button>
              </CardFooter>
            </form>
          </Card>
        )}

        {/* STEP 3: RECOVERY CODES & COMPLETION */}
        {step === 3 && (
          <Card className="border-border shadow-md">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto my-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <CardTitle className="text-base">Security Provisioning Complete</CardTitle>
              <CardDescription>
                Store your single-use backup recovery codes safely in case you lose access to your authenticator.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {recoveryCodes && recoveryCodes.length > 0 && (
                <div className="p-3 bg-muted rounded border font-mono text-xs grid grid-cols-2 gap-2 text-center select-all">
                  {recoveryCodes.map((c, i) => (
                    <div key={i} className="p-1 rounded bg-background/50 border border-border/50">
                      {c}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-1/2 text-xs"
                  onClick={handleCopyRecoveryCodes}
                >
                  <Copy className="h-3.5 w-3.5 mr-1.5" />
                  {copiedCodes ? 'Copied to Clipboard!' : 'Copy Codes'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-1/2 text-xs"
                  onClick={handleDownloadRecoveryCodes}
                >
                  <Download className="h-3.5 w-3.5 mr-1.5" /> Download (.txt)
                </Button>
              </div>
            </CardContent>
            <CardFooter className="border-t pt-4">
              <Button type="button" className="w-full" onClick={handleFinishSetup}>
                Complete Setup &amp; Access Command Center
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  );
}
