'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { authService } from '@/services/auth.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { CheckCircle2, AlertTriangle, Loader2, Mail, ArrowRight } from 'lucide-react';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resend state
  const [resendEmail, setResendEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    let isMounted = true;
    setVerifying(true);
    setError(null);

    authService
      .verifyEmail(token)
      .then((res) => {
        if (isMounted) {
          setVerified(true);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(
            err?.response?.data?.message ||
              err?.message ||
              'Verification link is invalid or has expired (24-hour limit).',
          );
        }
      })
      .finally(() => {
        if (isMounted) setVerifying(false);
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail) return;

    setResendLoading(true);
    setResendSuccess(null);
    setError(null);

    try {
      const res = await authService.resendVerification(resendEmail.trim());
      setResendSuccess(res.message || 'If registered, a new verification link was sent.');
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to dispatch verification email.');
    } finally {
      setResendLoading(false);
    }
  };

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
            {verifying ? (
              <div className="mx-auto my-2 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : verified ? (
              <div className="mx-auto my-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                <CheckCircle2 className="h-6 w-6" />
              </div>
            ) : error ? (
              <div className="mx-auto my-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive border border-destructive/20">
                <AlertTriangle className="h-6 w-6" />
              </div>
            ) : (
              <div className="mx-auto my-2 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Mail className="h-6 w-6 text-muted-foreground" />
              </div>
            )}

            <CardTitle className="text-lg">
              {verifying
                ? 'Verifying Security Token...'
                : verified
                ? 'Email Verified Successfully'
                : error
                ? 'Verification Failed'
                : 'Check Your Inbox'}
            </CardTitle>

            <CardDescription className="text-xs">
              {verifying
                ? 'Validating cryptographic signature with central identity server...'
                : verified
                ? 'Your email has been authenticated. Your account is now pending administrator review.'
                : error
                ? error
                : 'Click the link in the email we sent you to confirm your identity.'}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {verified && (
              <div className="rounded-md border border-border bg-muted/40 p-3 space-y-2 text-xs text-muted-foreground">
                <p className="font-semibold text-foreground">Clearance Approval Pending:</p>
                <p>
                  A Sentinel Supervisor will verify your credentials and assign your operational roles. You will
                  receive an email when your account is activated.
                </p>
              </div>
            )}

            {/* Resend Section if failed or waiting */}
            {(!verified && !verifying) && (
              <form onSubmit={handleResend} className="space-y-3 pt-2">
                {resendSuccess && (
                  <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-500 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>{resendSuccess}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="resendEmail" className="text-xs">
                    Need a new link? Enter official email:
                  </Label>
                  <Input
                    id="resendEmail"
                    type="email"
                    required
                    placeholder="name@agency.gov"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    className="h-9"
                  />
                </div>

                <Button type="submit" variant="outline" disabled={resendLoading} className="w-full h-9 text-xs">
                  {resendLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Resend Verification Email
                </Button>
              </form>
            )}
          </CardContent>

          <CardFooter className="flex flex-col gap-2 pt-0">
            <Button asChild className="w-full h-9 text-xs">
              <Link href={verified ? '/pending-approval' : '/login'}>
                {verified ? 'Check Approval Status' : 'Back to Sign-In'}
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
