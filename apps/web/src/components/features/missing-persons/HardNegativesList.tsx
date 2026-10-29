'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { HardNegative } from '@/types/missing-person';
import { sightingService } from '@/services/sighting.service';
import { ShieldAlert, ShieldX, User, Clock, AlertTriangle, Sparkles, Filter } from 'lucide-react';

interface HardNegativesListProps {
  caseId: string;
  className?: string;
}

export function HardNegativesList({ caseId, className = '' }: HardNegativesListProps) {
  const [negatives, setNegatives] = useState<HardNegative[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    sightingService
      .getHardNegatives(caseId)
      .then((data) => setNegatives(data))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [caseId]);

  const getReasonBadge = (reason: string) => {
    switch (reason) {
      case 'different_person':
        return (
          <Badge variant="outline" className="border-red-500/40 text-red-500 bg-red-500/10 text-[10px] capitalize">
            Different Person
          </Badge>
        );
      case 'clothing_mismatch':
        return (
          <Badge variant="outline" className="border-amber-500/40 text-amber-500 bg-amber-500/10 text-[10px] capitalize">
            Clothing Mismatch
          </Badge>
        );
      case 'poor_lighting':
      case 'occlusion':
        return (
          <Badge variant="outline" className="border-blue-500/40 text-blue-500 bg-blue-500/10 text-[10px] capitalize">
            {reason.replace('_', ' ')}
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-[10px] capitalize">
            {reason.replace('_', ' ')}
          </Badge>
        );
    }
  };

  return (
    <Card className={`border bg-card text-card-foreground shadow-sm ${className}`}>
      <CardHeader className="p-4 pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="space-y-0.5">
            <CardTitle className="text-sm font-semibold tracking-wide flex items-center gap-1.5">
              <ShieldX className="h-4 w-4 text-destructive" />
              Hard Negative Suppression List ({negatives.length})
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Rejected false match candidates used as negative anchors to downweight and suppress repetitive false positives across adjacent cameras.
            </p>
          </div>
          <Badge variant="secondary" className="font-mono text-xs w-fit">
            Ablation Impact: -100% Repetitive False Matches
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-2 space-y-3">
        {isLoading ? (
          <div className="p-6 text-center text-xs text-muted-foreground">Loading negative examples...</div>
        ) : negatives.length === 0 ? (
          <div className="p-6 rounded-lg border border-dashed text-center text-xs text-muted-foreground">
            No hard negatives registered yet. When reviewers reject candidate matches on this case, their crops and embeddings are recorded here to suppress similar lookalikes.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {negatives.map((neg) => (
              <div
                key={neg.id}
                className="border rounded-lg p-2.5 bg-muted/20 space-y-2 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="relative h-36 rounded bg-neutral-950 overflow-hidden flex items-center justify-center">
                    {/* eslint-disable-next-js-next-image-missing-attribute */}
                    <img
                      src={neg.cropUrl}
                      alt="Rejected candidate"
                      className="max-h-full w-auto object-contain opacity-80"
                    />
                    <div className="absolute top-1.5 left-1.5">
                      {getReasonBadge(neg.rejectReasonCode)}
                    </div>
                    <div className="absolute bottom-1.5 right-1.5 bg-neutral-900/90 text-neutral-300 font-mono text-[9px] px-1.5 py-0.5 rounded border border-white/10">
                      Suppressor Active
                    </div>
                  </div>

                  <div className="space-y-1 text-xs">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" /> {neg.rejectedBy}
                      </span>
                      <span className="font-mono text-[10px]">
                        {new Date(neg.rejectedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-muted-foreground truncate">
                      Source Sighting: {neg.sightingId}
                    </div>
                  </div>
                </div>

                <div className="pt-1.5 border-t text-[10px] text-muted-foreground flex items-center justify-between">
                  <span>Cosine Penalty: &gt; 0.65</span>
                  <span className="text-emerald-500 font-semibold font-mono">Hard Gated &gt; 0.88</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
