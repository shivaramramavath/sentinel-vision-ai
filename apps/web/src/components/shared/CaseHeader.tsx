'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusChip } from './StatusChip';
import { PriorityChip } from './PriorityChip';
import { ReadinessRing } from './ReadinessRing';
import { Case } from '@/types';
import { useCounts } from '@/hooks/use-counts';
import {
  MapPin,
  Clock,
  UserCheck,
  Search,
  Eye,
  Shield,
  ShieldAlert,
  ArrowRight,
  MoreVertical,
  Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CaseHeaderProps {
  caseData: Case;
  compact?: boolean;
  className?: string;
  onUpdateLastSeen?: () => void;
  onRunSearch?: () => void;
}

export function CaseHeader({
  caseData,
  compact = false,
  className,
  onUpdateLastSeen,
  onRunSearch,
}: CaseHeaderProps) {
  const router = useRouter();
  const { data: counts } = useCounts(`case:${caseData.id}`);
  const pendingCount = counts?.pendingReviews ?? counts?.pendingReview ?? 0;
  const isMinor =
    caseData.isMinor ||
    (caseData.dob
      ? (Date.now() - new Date(caseData.dob).getTime()) / (365.25 * 24 * 3600 * 1000) < 18
      : false);

  const primaryRef =
    caseData.referencePhotos?.[0]?.url ||
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80';

  if (compact) {
    return (
      <div
        className={cn(
          'flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3 shadow-sm select-none',
          className,
        )}
      >
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 border">
            <AvatarImage src={primaryRef} alt={caseData.personName} />
            <AvatarFallback>{caseData.personName.slice(0, 2)}</AvatarFallback>
          </Avatar>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-foreground">{caseData.personName}</span>
              <span className="font-mono text-xs text-muted-foreground">{caseData.caseNumber}</span>
              {isMinor && (
                <Badge
                  variant="outline"
                  className="border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] px-1 py-0 font-mono"
                >
                  <Shield className="mr-0.5 h-2.5 w-2.5" />
                  Minor
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <StatusChip status={caseData.status} size="sm" />
              <PriorityChip priority={caseData.priority} size="sm" />
              <span>• Officer: {caseData.assignedOfficer}</span>
            </div>
          </div>
        </div>

        {/* Quick actions in compact mode */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1.5"
            onClick={() => router.push(`/search?mode=case&case=${caseData.id}`)}
          >
            <Search className="h-3.5 w-3.5" />
            AI Search
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="h-8 text-xs gap-1.5"
            onClick={() => router.push(`/review?case=${caseData.id}`)}
          >
            <Eye className="h-3.5 w-3.5" />
            Review ({pendingCount})
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('rounded-xl border bg-card p-5 shadow-sm space-y-4 select-none', className)}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Person Identity Info */}
        <div className="flex items-start sm:items-center gap-4">
          <Avatar className="h-16 w-16 border-2 border-border shadow-sm">
            <AvatarImage src={primaryRef} alt={caseData.personName} />
            <AvatarFallback className="font-bold text-base">
              {caseData.personName.slice(0, 2)}
            </AvatarFallback>
          </Avatar>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                {caseData.personName}
              </h1>
              <span className="font-mono text-xs text-muted-foreground bg-muted/60 px-2 py-0.5 rounded border">
                {caseData.caseNumber}
              </span>
              {caseData.registrationAuth?.authority?.firOrCaseNumber && (
                <span className="font-mono text-xs text-muted-foreground">
                  FIR: {caseData.registrationAuth.authority.firOrCaseNumber}
                </span>
              )}
              {isMinor && (
                <Badge
                  variant="outline"
                  className="border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs px-2 py-0.5 font-mono shadow-sm"
                >
                  <ShieldAlert className="mr-1 h-3.5 w-3.5" />
                  Minor Protected (DOB {caseData.age ? `~${caseData.age}y` : ''})
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <StatusChip status={caseData.status} />
              <PriorityChip priority={caseData.priority} />
              <span className="text-muted-foreground flex items-center gap-1">
                <UserCheck className="h-3.5 w-3.5" />
                Assigned: {caseData.assignedOfficer}
              </span>
            </div>
          </div>
        </div>

        {/* Readiness Ring & Actions */}
        <div className="flex flex-wrap items-center gap-4">
          <ReadinessRing score={88} size={44} label="Search Readiness" />

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="default"
              onClick={onRunSearch || (() => router.push(`/search?mode=case&case=${caseData.id}`))}
              className="gap-1.5 shadow-sm"
            >
              <Search className="h-3.5 w-3.5" />
              Run AI Search
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => router.push(`/review?case=${caseData.id}`)}
              className="gap-1.5"
            >
              <Eye className="h-3.5 w-3.5" />
              Open Review ({pendingCount})
            </Button>
            {onUpdateLastSeen && (
              <Button size="sm" variant="outline" onClick={onUpdateLastSeen} className="gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                Update Last Seen
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Circumstances Strip */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t pt-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-foreground shrink-0" />
          <span>Last Seen: <strong className="text-foreground">{caseData.lastSeenLocation}</strong></span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-foreground shrink-0" />
          <span>Reported: {new Date(caseData.reportedAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <div className="flex items-center gap-1.5 font-mono">
          <span>Ref Set: v{caseData.referenceSetVersion || 1} ({caseData.referencePhotos?.length || 0} photos)</span>
        </div>
      </div>
    </div>
  );
}
