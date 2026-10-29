'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, AlertTriangle, KeyRound, ArrowLeft, Loader2 } from 'lucide-react';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/+$/, '');

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  const [email, setEmail] = useState('sarah.vance@sentinel.gov');
  const [password, setPassword] = useState('Investigator@2026');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaRequired, setMfaRequired] = useState(false);
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await login(email, password, mfaRequired ? mfaCode.trim() : undefined);
      if (res.success) {
        router.push('/dashboard');
      } else if (res.mfaRequired) {
        setMfaRequired(true);
      } else {
        setError(res.error || 'Invalid credentials or unauthorized access level');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = (provider: 'google' | 'github') => {
    window.location.href = `${API_BASE}/api/v1/auth/${provider}`;
  };

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
            Missing-Person Search, Person Re-ID & Cross-Camera Tracking
          </p>
        </div>

        {/* Login Card */}
        <Card className="border-border">
          <CardHeader className="space-y-1">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                {mfaRequired ? 'Two-Factor Authentication' : 'Operator Sign-In'}
              </CardTitle>
              <Badge variant="outline" className="font-mono text-[10px] text-amber-500 border-amber-500/30">
                RESTRICTED
              </Badge>
            </div>
            <CardDescription className="text-xs">
              {mfaRequired
                ? useRecoveryCode
                  ? 'Enter an emergency backup recovery code (e.g. A1B2-C3D4)'
                  : 'Enter the 6-digit code from your authenticator application'
                : 'Authenticate using your authorized Sentinel Vision security credentials.'}
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

              {!mfaRequired ? (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs">
                      Investigator / Badge Email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@sentinel.gov"
                      className="h-9"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password" className="text-xs">
                        Passcode / Security Token
                      </Label>
                      <Link
                        href="/forgot-password"
                        className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2"
                      >
                        Forgot password?
                      </Link>
                    </div>
                    <Input
                      id="password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-9"
                    />
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="mfaCode" className="text-xs">
                      {useRecoveryCode ? 'Emergency Recovery Code' : '6-Digit Authenticator Code'}
                    </Label>
                    <div className="relative">
                      <Input
                        id="mfaCode"
                        type="text"
                        autoFocus
                        required
                        value={mfaCode}
                        onChange={(e) => setMfaCode(e.target.value)}
                        placeholder={useRecoveryCode ? 'XXXX-XXXX' : '123456'}
                        className="h-10 text-center text-lg font-mono tracking-widest uppercase"
                      />
                      <KeyRound className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setUseRecoveryCode(!useRecoveryCode);
                        setMfaCode('');
                      }}
                      className="text-muted-foreground hover:text-foreground underline underline-offset-2"
                    >
                      {useRecoveryCode ? 'Use authenticator app code' : 'Lost device? Use recovery code'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMfaRequired(false);
                        setMfaCode('');
                        setError(null);
                      }}
                      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                    >
                      <ArrowLeft className="h-3 w-3" /> Back
                    </button>
                  </div>
                </div>
              )}

              <Button type="submit" disabled={loading} className="w-full h-9 text-xs font-medium">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mfaRequired ? 'Verify & Authenticate' : 'Sign In to Terminal'}
              </Button>

              {!mfaRequired && (
                <>
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-[10px] uppercase">
                      <span className="bg-card px-2 text-muted-foreground">Or single sign-on</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 text-xs"
                      onClick={() => handleOAuth('google')}
                    >
                      <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
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
                      Google
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 text-xs"
                      onClick={() => handleOAuth('github')}
                    >
                      <svg className="mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                        <path
                          fillRule="evenodd"
                          clipRule="evenodd"
                          d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                        />
                      </svg>
                      GitHub
                    </Button>
                  </div>
                </>
              )}
            </CardContent>

            <CardFooter className="flex flex-col gap-2 pt-0">
              <div className="text-center text-xs text-muted-foreground">
                Don&apos;t have an account?{' '}
                <Link href="/register" className="text-foreground hover:underline underline-offset-4">
                  Request access
                </Link>
              </div>
            </CardFooter>
          </form>
        </Card>

        {/* Security Notice */}
        <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground text-center">
          <Shield className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span>Statutory CJIS Compliant &middot; All sessions &amp; queries audited</span>
        </div>
      </div>
    </div>
  );
}
