'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useReports, useGenerateReport } from '@/hooks/use-reports';
import { useCases } from '@/hooks/use-cases';
import { FileText, Download, Plus, Clock, CheckCircle2 } from 'lucide-react';

export default function ReportsPage() {
  const { data: reports = [] } = useReports();
  const { data: cases = [] } = useCases();
  const generateMutation = useGenerateReport();
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    if (cases.length === 0) return;
    setGenerating(true);
    try {
      await generateMutation.mutateAsync({
        caseId: cases[0].id,
        title: `Consolidated Sighting & Tracking Dossier - ${cases[0].personName}`,
        format: 'PDF',
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit & Investigation Reports</h1>
          <p className="text-xs text-muted-foreground">
            Generate and export court-admissible dossiers, verification summaries, and custody audit logs
          </p>
        </div>
        <Button onClick={handleGenerate} disabled={generating || cases.length === 0} size="sm" className="h-8 gap-1.5 font-medium">
          <Plus className="h-4 w-4" />
          {generating ? 'Compiling Dossier...' : 'Generate New PDF Report'}
        </Button>
      </div>

      <div className="space-y-3">
        {reports.map((rep) => (
          <Card key={rep.id} className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded border bg-muted flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm leading-none">{rep.title}</span>
                  <Badge variant="outline" className="text-[10px] font-mono uppercase">
                    {rep.format}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-[10px] font-mono text-emerald-500 border-emerald-500/40"
                  >
                    <CheckCircle2 className="mr-1 h-3 w-3" /> Ready
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
                  <span>Author: {rep.generatedBy}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {rep.generatedAt || (rep as any).createdAt || ''}
                  </span>
                </div>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 font-mono text-xs"
              onClick={() => alert(`Downloading verified report: ${rep.title}`)}
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
