'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authService } from '@/services/auth.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Shield, AlertTriangle, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [consented, setConsented] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registeredSuccess, setRegisteredSuccess] = useState(false);

  // Password strength evaluation
  const passwordStrength = useMemo(() => {
    if (!password) return { score: 0, label: 'Too short', color: 'bg-muted' };
    let score = 0;
    if (password.length >= 10) score += 1;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    switch (score) {
      case 1:
        return { score: 1, label: 'Weak (min 10 characters required)', color: 'bg-red-500' };
      case 2:
        return { score: 2, label: 'Fair (add numbers or symbols)', color: 'bg-amber-500' };
      case 3:
        return { score: 3, label: 'Good', color: 'bg-emerald-500' };
      case 4:
        return { score: 4, label: 'Strong (Security standard met)', color: 'bg-emerald-600' };
      default:
        return { score: 0, label: 'Too weak', color: 'bg-red-500' };
    }
  }, [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 10) {
      setError('Password must be at least 10 characters long.');
      return;
    }

    if (!consented) {
      setError('You must accept the CJIS & Criminal Justice Data statutory consent to proceed.');
      return;
    }

    setLoading(true);
    try {
      await authService.register({
        name: name.trim(),
        email: email.trim(),
        password,
        inviteCode: inviteCode.trim() ? inviteCode.trim() : undefined,
        consent: consented,
      });

      setRegisteredSuccess(true);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to submit registration. Please check your inputs.',
      );
    } finally {
      setLoading(false);
    }
  };

  if (registeredSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg border bg-card text-2xl font-bold shadow-sm font-mono">
              ⬡
            </div>
            <h1 className="text-2xl font-bold tracking-tight">SENTINEL VISION AI</h1>
          </div>

          <Card className="border-border">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto my-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <CardTitle className="text-lg">Registration Submitted</CardTitle>
              <CardDescription className="text-xs">
                A verification link has been dispatched to <span className="font-mono text-foreground">{email}</span>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs text-muted-foreground leading-relaxed">
              <div className="rounded-md border border-border bg-muted/40 p-3 space-y-2">
                <p className="font-semibold text-foreground">Next Steps:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Click the verification link in your email (valid for 24 hours).</li>
                  <li>Once verified, your account enters administrative review.</li>
                  <li>A Sentinel Supervisor will review credentials and assign your clearance level.</li>
                </ol>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-2 pt-0">
              <Button asChild className="w-full h-9 text-xs">
                <Link href="/login">Return to Sign-In</Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg border bg-card text-2xl font-bold shadow-sm font-mono">
            ⬡
          </div>
          <h1 className="text-2xl font-bold tracking-tight">SENTINEL VISION AI</h1>
          <p className="text-xs text-muted-foreground">
            Official Law Enforcement &amp; Authorized Personnel Registration
          </p>
        </div>

        {/* Card */}
        <Card className="border-border">
          <CardHeader className="space-y-1">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Request Access Account</CardTitle>
              <Badge variant="outline" className="font-mono text-[10px] text-amber-500 border-amber-500/30">
                SUPERVISOR APPROVAL REQ.
              </Badge>
            </div>
            <CardDescription className="text-xs">
              All accounts undergo mandatory agency verification prior to operational activation.
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs">
                  Full Name &amp; Rank / Title
                </Label>
                <Input
                  id="name"
                  type="text"
                  required
                  placeholder="Det. Alex Mercer"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs">
                  Agency / Official Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  required
                  placeholder="a.mercer@agency.gov"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs">
                  Security Passphrase (min 10 characters)
                </Label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-9 font-mono"
                />

                {/* Password Strength Indicator */}
                {password.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <div className="flex h-1.5 w-full gap-1 overflow-hidden rounded bg-muted">
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

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="inviteCode" className="text-xs">
                    Station / Department Invite Code (Optional)
                  </Label>
                  <span className="text-[10px] text-muted-foreground">e.g. INV-8921-X</span>
                </div>
                <Input
                  id="inviteCode"
                  type="text"
                  placeholder="Leave blank if registering independently"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  className="h-9 font-mono uppercase"
                />
              </div>

              {/* Statutory consent */}
              <div className="flex items-start space-x-2 pt-1">
                <Checkbox
                  id="consent"
                  checked={consented}
                  onCheckedChange={(checked) => setConsented(checked === true)}
                  className="mt-0.5"
                />
                <label
                  htmlFor="consent"
                  className="text-[11px] text-muted-foreground leading-snug cursor-pointer select-none"
                >
                  I certify that I am an authorized law enforcement or emergency operations official, and
                  agree to statutory biometric data retention and comprehensive audit logging.
                </label>
              </div>

              <Button
                type="submit"
                disabled={loading || !consented || passwordStrength.score < 2}
                className="w-full h-9 text-xs font-medium"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit Request for Clearance
              </Button>
            </CardContent>

            <CardFooter className="flex flex-col gap-2 pt-0">
              <div className="text-center text-xs text-muted-foreground">
                Already hold active clearance?{' '}
                <Link href="/login" className="text-foreground hover:underline underline-offset-4">
                  Sign in
                </Link>
              </div>
            </CardFooter>
          </form>
        </Card>

        {/* Security Notice */}
        <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground text-center">
          <Shield className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span>Statutory CJIS Compliant &middot; All queries recorded</span>
        </div>
      </div>
    </div>
  );
}
