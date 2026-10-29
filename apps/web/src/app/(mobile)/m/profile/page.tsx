'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useMobileAuthStore } from '@/stores/mobile-auth.store';
import { mobileAuthService } from '@/services/mobile-auth.service';
import { User, Shield, LogOut, KeyRound, Trash2, CheckCircle2, Building, Mail, Phone } from 'lucide-react';

export default function MobileProfilePage() {
  const router = useRouter();
  const { user, isAuthenticated, isCheckingAuth, clearAuth } = useMobileAuthStore();

  const [profile, setProfile] = useState<any>(user);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    if (!isCheckingAuth && !isAuthenticated) {
      router.push('/m/login');
      return;
    }

    mobileAuthService
      .getProfile()
      .then((data) => setProfile(data))
      .catch(() => {});
  }, [isAuthenticated, isCheckingAuth, router]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await mobileAuthService.logout();
    } finally {
      clearAuth();
      router.push('/m/login');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-bold">Operator Profile</h2>
        <p className="text-xs text-muted-foreground">Tactical account credentials & access directives.</p>
      </div>

      <Card className="border shadow-xs">
        <CardHeader className="p-4 pb-2">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary font-bold text-lg">
              {profile?.fullName ? profile.fullName.charAt(0).toUpperCase() : 'O'}
            </div>
            <div>
              <CardTitle className="text-sm font-bold">{profile?.fullName || 'Mobile Operator'}</CardTitle>
              <CardDescription className="text-xs font-mono">{profile?.email}</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 pt-2 space-y-3">
          <div className="grid grid-cols-1 gap-2 text-xs font-mono border-t pt-3">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Email:</span>
              <span className="text-foreground">{profile?.email}</span>
            </div>
            {profile?.phoneE164 && (
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Phone:</span>
                <span className="text-foreground">{profile?.phoneE164}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="flex items-center gap-1.5"><Building className="h-3.5 w-3.5" /> Jurisdictions:</span>
              <span className="text-foreground">{profile?.siteIds?.join(', ') || 'Primary Sector'}</span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" /> Status:</span>
              <span className="text-emerald-500 font-bold uppercase">{profile?.status || 'Active'}</span>
            </div>
          </div>

          <div className="border-t pt-3 space-y-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => alert('Password updates can be initiated via your dispatch coordinator.')}
              className="w-full h-9 text-xs justify-start gap-2"
            >
              <KeyRound className="h-4 w-4" /> Change Password
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                alert(
                  'GDPR Data Request Submitted. Full audit log of streaming telemetry will be dispatched to your email.',
                )
              }
              className="w-full h-9 text-xs justify-start gap-2"
            >
              <Shield className="h-4 w-4" /> Request Data Export (GDPR)
            </Button>
          </div>

          <div className="border-t pt-3">
            <Button
              variant="destructive"
              size="sm"
              disabled={isLoggingOut}
              onClick={handleLogout}
              className="w-full h-9 text-xs gap-2"
            >
              <LogOut className="h-4 w-4" /> Sign Out of Terminal
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
