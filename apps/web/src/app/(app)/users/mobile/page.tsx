'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { MobileIngestionPanel } from '@/components/features/cameras/MobileIngestionPanel';
import { ArrowLeft, Smartphone, ShieldCheck } from 'lucide-react';

export default function MobileUsersPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/users">
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground gap-1">
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Users
              </Button>
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Smartphone className="h-6 w-6 text-cyan-400" /> Mobile Field Operators & Devices
          </h1>
          <p className="text-xs text-muted-foreground">
            Manage mobile field operators, approve pending registrations, review hardware devices, and generate sector invites.
          </p>
        </div>
      </div>

      {/* Main Management Panel */}
      <MobileIngestionPanel />
    </div>
  );
}
