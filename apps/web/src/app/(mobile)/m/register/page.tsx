'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { mobileAuthService } from '@/services/mobile-auth.service';
import { Shield, ShieldAlert, ArrowRight, Loader2, CheckCircle2, Lock } from 'lucide-react';

function MobileRegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialInvite = searchParams.get('invite') || '';

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState(initialInvite);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (initialInvite) {
      setInviteCode(initialInvite);
    }
  }, [initialInvite]);

  // Client-side password strength estimate (0 to 4 score)
  const passwordScore = useMemo(() => {
    if (!password) return 0;
    let score = 0;
    if (password.length >= 10) score += 1;
    if (password.length >= 14) score += 1;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 0.5;
    if (/[^A-Za-z0-9]/.test(password)) score += 0.5;
    return Math.min(4, Math.floor(score));
  }, [password]);

  const strengthLabel = useMemo(() => {
    switch (passwordScore) {
      case 0:
      case 1:
        return { text: 'Very Weak (Min 10 chars)', color: 'text-rose-500', bar: 25 };
      case 2:
        return { text: 'Moderate (Needs symbols/mixed case)', color: 'text-amber-500', bar: 50 };
      case 3:
        return { text: 'Strong (Acceptable)', color: 'text-emerald-500', bar: 75 };
      case 4:
        return { text: 'Very Strong', color: 'text-emerald-400', bar: 100 };
      default:
        return { text: '', color: '', bar: 0 };
    }
  }, [passwordScore]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (password.length < 10) {
      setErrorMessage('Password must be at least 10 characters long.');
      return;
    }
    if (passwordScore < 3) {
      setErrorMessage('Please choose a stronger passphrase (score >= 3).');
      return;
    }
    if (!consentAccepted) {
      setErrorMessage('You must accept the statutory surveillance consent to proceed.');
      return;
    }

    setIsLoading(true);
    try {
      await mobileAuthService.register({
        fullName,
        email,
        phone: phone || undefined,
        password,
        inviteCode: inviteCode || undefined,
        consentAccepted: true,
      });

      router.push(`/m/verify?email=${encodeURIComponent(email.toLowerCase().trim())}`);
    } catch (err: any) {
      setErrorMessage(
        err.response?.data?.message || 'Registration failed. Please verify your details.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-center py-4">
      <Card className="border-border shadow-sm">
        <CardHeader className="space-y-1 p-4 pb-2">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle className="text-base font-bold">Mobile Operator Registration</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Join the tactical video streaming network for authorized search operations.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-4 pt-2">
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {errorMessage && (
              <div className="rounded-md border border-rose-500/40 bg-rose-500/10 p-2.5 text-xs text-rose-400 flex items-start gap-2">
                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-rose-500" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs">Full Name</Label>
              <Input
                required
                placeholder="e.g. Officer Sarah Connor"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="h-10 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Official Email Address</Label>
              <Input
                required
                type="email"
                placeholder="officer@department.gov"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-10 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Mobile Phone (Optional, E.164)</Label>
              <Input
                type="tel"
                placeholder="+1 555 123 4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-10 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Passphrase (Min 10 characters)</Label>
              <Input
                required
                type="password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-10 text-xs font-mono"
              />
              {password && (
                <div className="pt-1 space-y-1">
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-muted-foreground">Strength:</span>
                    <span className={strengthLabel.color}>{strengthLabel.text}</span>
                  </div>
                  <Progress value={strengthLabel.bar} className="h-1" />
                </div>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Invite Code (Optional)</Label>
              <Input
                placeholder="e.g. SENT-7A9B"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                className="h-10 text-xs font-mono uppercase tracking-wider"
              />
            </div>

            {/* Mandatory Statutory Consent */}
            <div className="rounded-lg border border-border/80 bg-muted/20 p-3 space-y-2">
              <div className="flex items-start gap-2.5">
                <Checkbox
                  id="consent"
                  checked={consentAccepted}
                  onCheckedChange={(c) => setConsentAccepted(Boolean(c))}
                  className="mt-0.5"
                />
                <Label htmlFor="consent" className="text-xs leading-snug cursor-pointer">
                  I certify authorization under departmental jurisdiction and consent to live
                  camera and telemetry sharing with the search team.
                </Label>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading || !consentAccepted}
              className="w-full h-11 text-xs font-semibold gap-2 mt-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                <>
                  Continue to Verification <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>

            <div className="text-center pt-2 text-xs text-muted-foreground">
              Already have an account?{' '}
              <Link href="/m/login" className="text-primary font-medium hover:underline">
                Log In
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function MobileRegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <MobileRegisterContent />
    </Suspense>
  );
}
