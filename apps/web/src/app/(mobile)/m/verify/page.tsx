'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { mobileAuthService } from '@/services/mobile-auth.service';
import { ShieldCheck, ShieldAlert, ArrowRight, Loader2, RotateCcw } from 'lucide-react';

function MobileVerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams.get('email') || '';

  const [email, setEmail] = useState(emailParam);
  const [otp, setOtp] = useState('');
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  useEffect(() => {
    if (emailParam) {
      setEmail(emailParam);
    }
  }, [emailParam]);

  // Resend OTP countdown
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [countdown]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);

    if (otp.length !== 6) {
      setErrorMessage('Please enter a 6-digit verification code.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await mobileAuthService.verify({
        email,
        otp,
      });

      if (res.status === 'active') {
        router.push('/m/login?activated=true');
      } else {
        router.push(`/m/pending?email=${encodeURIComponent(email)}`);
      }
    } catch (err: any) {
      setErrorMessage(
        err.response?.data?.message || 'Verification failed. Please check the code.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend || !email) return;
    setIsResending(true);
    setErrorMessage(null);
    try {
      await mobileAuthService.resendOtp(email);
      setInfoMessage('A new verification code has been dispatched.');
      setCountdown(60);
      setCanResend(false);
    } catch (err: any) {
      setErrorMessage('Failed to resend code. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-center py-6">
      <Card className="border-border shadow-sm">
        <CardHeader className="space-y-1 p-4 pb-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <CardTitle className="text-base font-bold">Verify Security Code</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Enter the 6-digit code dispatched to{' '}
            <span className="font-mono text-foreground font-semibold">{email || 'your email'}</span>.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-4 pt-2">
          <form onSubmit={handleVerify} className="space-y-4">
            {errorMessage && (
              <div className="rounded-md border border-rose-500/40 bg-rose-500/10 p-2.5 text-xs text-rose-400 flex items-start gap-2">
                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-rose-500" />
                <span>{errorMessage}</span>
              </div>
            )}

            {infoMessage && (
              <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-2.5 text-xs text-emerald-400">
                {infoMessage}
              </div>
            )}

            {!emailParam && (
              <div className="space-y-1">
                <Label className="text-xs">Email Address</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-10 text-xs"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">6-Digit Code</Label>
              <Input
                required
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                className="h-12 text-center text-xl font-mono tracking-widest"
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading || otp.length !== 6}
              className="w-full h-11 text-xs font-semibold gap-2 mt-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  Confirm Code <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>

            <div className="flex items-center justify-between text-xs pt-2">
              <span className="text-muted-foreground">Didn&apos;t receive code?</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!canResend || isResending}
                onClick={handleResend}
                className="h-8 text-xs gap-1 font-mono"
              >
                {isResending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RotateCcw className="h-3 w-3" />
                )}
                {canResend ? 'Resend Code' : `Resend in ${countdown}s`}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function MobileVerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <MobileVerifyContent />
    </Suspense>
  );
}
