'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePermission } from '@/hooks/use-permission';
import { firstAccessibleSection } from '@/config/admin-sections';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export default function AdminIndexPage() {
  const router = useRouter();
  const { can, status, roleMeta } = usePermission();

  const targetSection = status === 'success' ? firstAccessibleSection(can) : null;

  useEffect(() => {
    if (status === 'success' && targetSection) {
      router.replace(`/admin/${targetSection}`);
    }
  }, [status, targetSection, router]);

  if (status === 'loading') {
    return (
      <div className="space-y-6 p-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-4">
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full rounded-md" />
            ))}
          </div>
          <div className="md:col-span-3 space-y-4">
            <Skeleton className="h-48 w-full rounded-lg" />
            <Skeleton className="h-64 w-full rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (status === 'success' && !targetSection) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <Card className="max-w-md w-full border-destructive/30 bg-destructive/5 text-center">
          <CardHeader className="pb-3 flex flex-col items-center">
            <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mb-2">
              <ShieldAlert className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle className="text-lg font-bold">Access Denied (403)</CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-1">
              You do not have administrative clearance or permissions to view any administration module.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link href={roleMeta.landing || '/dashboard'}>
                <ArrowLeft className="h-4 w-4" />
                Return to Operational Portal
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-96" />
    </div>
  );
}
