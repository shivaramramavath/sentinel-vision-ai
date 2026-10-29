import React from 'react';
import { cn } from '@/lib/utils';

export function KbdHint({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <kbd
      className={cn(
        'pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted/60 px-1.5 font-mono text-[10px] font-medium text-muted-foreground shadow-sm',
        className,
      )}
    >
      {children}
    </kbd>
  );
}
