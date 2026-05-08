'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, AlertCircle, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getProfileScenario } from '@/lib/api/profile-scenarios';
import type { ProfileScenarioDetail } from '@/types/profile-scenario';
import { ScenarioReport, type ScenarioReportData } from '@/components/reports/ScenarioReport';

export default function ScenarioReportPage() {
  const params = useParams();
  const id = String(params['id'] ?? '');
  const [scenario, setScenario] = useState<ProfileScenarioDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchScenario = useCallback(async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      setError(null);
      const data = await getProfileScenario(id);
      setScenario(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scenario');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchScenario();
  }, [fetchScenario]);

  if (isLoading) {
    return (
      <div className="bg-ds-surface rounded-card p-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-ds-primary" />
      </div>
    );
  }

  if (error ?? !scenario) {
    return (
      <div className="bg-ds-surface rounded-card p-12 flex flex-col items-center justify-center gap-4">
        <AlertCircle className="h-12 w-12 text-ds-error" />
        <p className="text-muted-foreground">{error ?? 'Scenario not found'}</p>
        <Button
          variant="outline"
          className="border-ds-outline-variant"
          onClick={() => void fetchScenario()}
        >
          Try again
        </Button>
      </div>
    );
  }

  const generatedAt = scenario.calculated_at ? new Date(scenario.calculated_at) : new Date();
  const resultData = (scenario.result_data as ScenarioReportData | null) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 print:hidden">
        <Link href="/reports">
          <Button variant="ghost" size="sm" className="hover:bg-ds-surface-raised">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to reports
          </Button>
        </Link>
        <Button
          variant="outline"
          size="sm"
          className="border-ds-outline-variant hover:bg-ds-surface-raised"
          onClick={() => window.print()}
        >
          <Printer className="mr-2 h-4 w-4" />
          Print / Save as PDF
        </Button>
      </div>

      <ScenarioReport
        scenarioName={scenario.name}
        generatedAt={generatedAt}
        resultData={resultData}
      />
    </div>
  );
}
