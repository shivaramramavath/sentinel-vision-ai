'use client';

import React from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useUiStore } from '@/stores/ui.store';
import { useCases } from '@/hooks/use-cases';
import { Button } from '@/components/ui/button';
import { PriorityChip } from './PriorityChip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FolderOpen, X, ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export function CaseSwitcher({ className }: { className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { activeCaseId, setActiveCaseId } = useUiStore();
  const { data: cases = [] } = useCases();

  // Check URL parameter first, fallback to store
  const urlCaseId = searchParams.get('case');
  const effectiveCaseId = urlCaseId || activeCaseId || cases[0]?.id;
  const currentCase = cases.find((c) => c.id === effectiveCaseId || c.caseNumber === effectiveCaseId) ?? cases[0];

  const handleSelectCase = (caseId: string) => {
    setActiveCaseId(caseId);
    // If on a page that takes ?case= parameter, update URL
    if (['/search', '/review', '/journeys', '/tracking'].includes(pathname)) {
      const params = new URLSearchParams(searchParams.toString());
      params.set('case', caseId);
      router.push(`${pathname}?${params.toString()}`);
    } else if (pathname.startsWith('/cases/')) {
      router.push(`/cases/${caseId}`);
    }
  };

  const handleClearContext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveCaseId(null);
    if (['/search', '/review', '/journeys', '/tracking'].includes(pathname)) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('case');
      router.push(`${pathname}?${params.toString()}`);
    }
  };

  if (!currentCase) return null;

  return (
    <div className={cn('flex items-center', className)}>
      <DropdownMenu>
        <div className="flex items-center rounded-md border border-dashed bg-secondary/30 text-xs font-medium">
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-2 px-2.5 hover:bg-secondary/50 text-xs font-normal"
            >
              <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-semibold text-foreground max-w-[140px] truncate">
                Case: {currentCase.personName}
              </span>
              <PriorityChip priority={currentCase.priority} size="sm" />
              <ChevronDown className="h-3 w-3 text-muted-foreground opacity-60" />
            </Button>
          </DropdownMenuTrigger>

          {effectiveCaseId && (
            <button
              onClick={handleClearContext}
              className="px-1.5 py-1 text-muted-foreground hover:text-foreground transition-colors"
              title="Clear Active Case Context"
              aria-label="Clear active case"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <DropdownMenuContent align="start" className="w-72">
          <DropdownMenuLabel className="flex items-center justify-between text-xs font-mono">
            <span>SWITCH ACTIVE CASE</span>
            <span className="text-[10px] text-muted-foreground">({cases.length} cases)</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <div className="max-h-60 overflow-y-auto space-y-0.5">
            {cases.map((c) => {
              const isSelected = c.id === currentCase.id;
              return (
                <DropdownMenuItem
                  key={c.id}
                  onClick={() => handleSelectCase(c.id)}
                  className="flex items-center justify-between cursor-pointer py-1.5"
                >
                  <div className="flex items-center gap-2 truncate">
                    {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                    <div className="flex flex-col truncate">
                      <span className="font-medium text-xs truncate">{c.personName}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {c.caseNumber} • {c.lastSeenLocation.split(',')[0]}
                      </span>
                    </div>
                  </div>
                  <PriorityChip priority={c.priority} size="sm" />
                </DropdownMenuItem>
              );
            })}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
