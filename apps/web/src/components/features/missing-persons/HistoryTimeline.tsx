'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FieldDiffHistory } from '@/types/missing-person';
import { History, User, Clock, ArrowRight, FileEdit } from 'lucide-react';

interface HistoryTimelineProps {
  history: FieldDiffHistory[];
  className?: string;
}

export function HistoryTimeline({ history, className = '' }: HistoryTimelineProps) {
  if (!history || history.length === 0) {
    return (
      <Card className={`border bg-card p-6 text-center text-xs text-muted-foreground ${className}`}>
        No historical field changes recorded yet. Initial creation was version 1.
      </Card>
    );
  }

  return (
    <Card className={`border bg-card text-card-foreground shadow-sm ${className}`}>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm font-semibold tracking-wide flex items-center gap-1.5">
          <History className="h-4 w-4 text-primary" />
          Field-Level Audit Trail & Concurrency History
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        <div className="relative border-l-2 border-border ml-3 my-2 space-y-6">
          {history.map((entry, idx) => {
            const formattedDate = new Date(entry.at).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div key={idx} className="relative pl-6">
                {/* Timeline node icon */}
                <div className="absolute -left-[9px] top-0.5 w-4 h-4 rounded-full bg-background border-2 border-primary flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                </div>

                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1">
                      <User className="h-3 w-3 text-muted-foreground" />
                      {entry.actor}
                    </span>
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-mono">
                      <Clock className="h-3 w-3" />
                      {formattedDate}
                    </span>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {entry.changedFields?.length || 1} fields modified
                    </Badge>
                  </div>

                  {/* Changes List */}
                  <div className="space-y-1 text-xs">
                    {entry.changedFields?.map((field: string) => {
                      const beforeVal = entry.before?.[field];
                      const afterVal = entry.after?.[field];
                      return (
                        <div
                          key={field}
                          className="p-2 rounded bg-muted/30 border border-border/50 font-mono text-[11px] flex flex-col sm:flex-row sm:items-center justify-between gap-1"
                        >
                          <span className="font-semibold text-primary">{field}:</span>
                          <div className="flex items-center gap-2 overflow-x-auto text-muted-foreground">
                            <span className="truncate max-w-[150px] line-through">
                              {JSON.stringify(beforeVal) ?? 'undefined'}
                            </span>
                            <ArrowRight className="h-3 w-3 shrink-0 text-foreground" />
                            <span className="text-foreground font-semibold truncate max-w-[200px]">
                              {JSON.stringify(afterVal) ?? 'null'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
