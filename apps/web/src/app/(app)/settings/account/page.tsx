'use client';

import React from 'react';
import { AccountSecuritySettings } from '@/components/features/settings/account-security-settings';

export default function AccountSettingsPage() {
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
