'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { mobileAuthService } from '@/services/mobile-auth.service';
import { useMobileAuthStore } from '@/stores/mobile-auth.store';
import { Shield, ShieldAlert, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';

function MobileLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams.get('email') || '';
  const activated = searchParams.get('activated') === 'true';

  const [email, setEmail] = useState(emailParam);
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { setAuth } = useMobileAuthStore();

  useEffect(() => {
    if (emailParam) {
      setEmail(emailParam);
    }
  }, [emailParam]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const res = await mobileAuthService.login({
        email,
        password,
      });

      setAuth(res.user, res.accessToken);
      router.push('/m/devices');
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Login failed. Invalid credentials.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-center py-6">
      <Card className="border-border shadow-sm">
        <CardHeader className="space-y-1 p-4 pb-2">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle className="text-base font-bold">Mobile Operator Login</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Authenticate your field terminal to initialize live bodycam broadcasting.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-4 pt-2">
          {activated && (
            <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-2.5 text-xs text-emerald-400 mb-3 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
              <span>Account activated! You can now log in.</span>
            </div>
          )}

          {errorMessage && (
            <div className="rounded-md border border-rose-500/40 bg-rose-500/10 p-2.5 text-xs text-rose-400 mb-3 flex items-start gap-2">
              <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-rose-500" />
              <div className="space-y-1">
                <span>{errorMessage}</span>
                {errorMessage.includes('awaiting administrator approval') && (
                  <div>
                    <Link
                      href={`/m/pending?email=${encodeURIComponent(email)}`}
                      className="underline font-bold text-white block mt-1"
                    >
                      View Approval Status →
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-3.5">
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
              <div className="flex items-center justify-between">
                <Label className="text-xs">Password</Label>
                <Link
                  href="/m/login"
                  onClick={() => alert('Please contact supervisor to reset password via dispatch.')}
                  className="text-[11px] text-muted-foreground hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                required
                type="password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-10 text-xs font-mono"
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 text-xs font-semibold gap-2 mt-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  Sign In to Terminal <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>

            <div className="text-center pt-2 text-xs text-muted-foreground">
              Don&apos;t have an operator account?{' '}
              <Link href="/m/register" className="text-primary font-medium hover:underline">
                Register Here
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function MobileLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <MobileLoginContent />
    </Suspense>
  );
}
