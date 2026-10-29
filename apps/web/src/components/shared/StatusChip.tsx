import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ShieldAlert, Clock, CheckCircle2, XCircle, HelpCircle } from 'lucide-react';

export type StatusChipType =
  | 'draft'
  | 'active'
  | 'under_review'
  | 'found'
  | 'closed'
  | 'pending_review'
  | 'confirmed_sighting'
  | 'rejected'
  | 'need_evidence'
  | string;

interface StatusChipProps {
  status: StatusChipType;
  className?: string;
  size?: 'sm' | 'default';
}

export function StatusChip({ status, className, size = 'default' }: StatusChipProps) {
  const norm = status?.toLowerCase() || '';

  // Wording & Color Rules:
  // Amber = unverified/possible/pending
  // Blue = reviewer-confirmed
  // Neutral/Outline = rejected, need evidence, closed, draft
  if (norm === 'pending_review' || norm === 'possible') {
    return (
      <Badge
        variant="outline"
        className={cn(
          'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium font-mono',
          size === 'sm' ? 'text-[10px] px-1.5 py-0' : 'text-xs px-2 py-0.5',
          className,
        )}
      >
        <Clock className="mr-1 h-3 w-3" />
        Possible match
      </Badge>
    );
  }

  if (norm === 'confirmed_sighting' || norm === 'confirmed') {
    return (
      <Badge
        variant="default"
        className={cn(
          'bg-blue-600 hover:bg-blue-600 text-white font-medium font-mono border-blue-500',
          size === 'sm' ? 'text-[10px] px-1.5 py-0' : 'text-xs px-2 py-0.5',
          className,
        )}
      >
        <CheckCircle2 className="mr-1 h-3 w-3" />
        Confirmed by reviewer
      </Badge>
    );
  }

  if (norm === 'rejected') {
    return (
      <Badge
        variant="outline"
        className={cn(
          'border-muted-foreground/30 text-muted-foreground bg-muted/20 font-mono',
          size === 'sm' ? 'text-[10px] px-1.5 py-0' : 'text-xs px-2 py-0.5',
          className,
        )}
      >
        <XCircle className="mr-1 h-3 w-3" />
        Not same person
      </Badge>
    );
  }

  if (norm === 'need_evidence') {
    return (
      <Badge
        variant="outline"
        className={cn(
          'border-amber-400/40 text-muted-foreground bg-muted/20 font-mono',
          size === 'sm' ? 'text-[10px] px-1.5 py-0' : 'text-xs px-2 py-0.5',
          className,
        )}
      >
        <HelpCircle className="mr-1 h-3 w-3" />
        Need more evidence
      </Badge>
    );
  }

  // Case Lifecycles
  if (norm === 'active') {
    return (
      <Badge
        variant="secondary"
        className={cn(
          'border border-primary/20 bg-primary/10 text-primary font-medium font-mono',
          size === 'sm' ? 'text-[10px] px-1.5 py-0' : 'text-xs px-2 py-0.5',
          className,
        )}
      >
        Active
      </Badge>
    );
  }

  if (norm === 'under_review') {
    return (
      <Badge
        variant="outline"
        className={cn(
          'border-amber-500/30 bg-amber-500/10 text-amber-500 font-mono',
          size === 'sm' ? 'text-[10px] px-1.5 py-0' : 'text-xs px-2 py-0.5',
          className,
        )}
      >
        Under review
      </Badge>
    );
  }

  if (norm === 'found') {
    return (
      <Badge
        variant="outline"
        className={cn(
          'border-blue-500/40 bg-blue-500/10 text-blue-500 font-mono',
          size === 'sm' ? 'text-[10px] px-1.5 py-0' : 'text-xs px-2 py-0.5',
          className,
        )}
      >
        Found
      </Badge>
    );
  }

  if (norm === 'closed') {
    return (
      <Badge
        variant="outline"
        className={cn(
          'border-muted-foreground/30 text-muted-foreground font-mono',
          size === 'sm' ? 'text-[10px] px-1.5 py-0' : 'text-xs px-2 py-0.5',
          className,
        )}
      >
        Closed
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        'font-mono uppercase text-muted-foreground',
        size === 'sm' ? 'text-[10px] px-1.5 py-0' : 'text-xs px-2 py-0.5',
        className,
      )}
    >
      {status}
    </Badge>
  );
}
