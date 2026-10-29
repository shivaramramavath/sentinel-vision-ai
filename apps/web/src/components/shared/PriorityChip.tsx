import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { AlertCircle, ShieldAlert } from 'lucide-react';

interface PriorityChipProps {
  priority: 'critical' | 'high' | 'medium' | 'low' | string;
  className?: string;
  size?: 'sm' | 'default';
}

export function PriorityChip({ priority, className, size = 'default' }: PriorityChipProps) {
  const norm = priority?.toLowerCase() || '';

  // Only Critical is red
  if (norm === 'critical') {
    return (
      <Badge
        variant="destructive"
        className={cn(
          'font-mono uppercase tracking-wider font-semibold bg-rose-600 text-white hover:bg-rose-600 border-rose-500',
          size === 'sm' ? 'text-[10px] px-1.5 py-0' : 'text-xs px-2 py-0.5',
          className,
        )}
      >
        <ShieldAlert className="mr-1 h-3 w-3" />
        Critical
      </Badge>
    );
  }

  // High is amber
  if (norm === 'high') {
    return (
      <Badge
        variant="outline"
        className={cn(
          'font-mono uppercase tracking-wider font-medium border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400',
          size === 'sm' ? 'text-[10px] px-1.5 py-0' : 'text-xs px-2 py-0.5',
          className,
        )}
      >
        <AlertCircle className="mr-1 h-3 w-3" />
        High
      </Badge>
    );
  }

  // Medium is slate/neutral
  if (norm === 'medium') {
    return (
      <Badge
        variant="outline"
        className={cn(
          'font-mono uppercase tracking-wider font-medium border-border bg-secondary/40 text-foreground',
          size === 'sm' ? 'text-[10px] px-1.5 py-0' : 'text-xs px-2 py-0.5',
          className,
        )}
      >
        Medium
      </Badge>
    );
  }

  // Low is subtle muted
  return (
    <Badge
      variant="outline"
      className={cn(
        'font-mono uppercase tracking-wider text-muted-foreground border-dashed',
        size === 'sm' ? 'text-[10px] px-1.5 py-0' : 'text-xs px-2 py-0.5',
        className,
      )}
    >
      Low
    </Badge>
  );
}
